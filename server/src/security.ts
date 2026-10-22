/* Passwords, tokens, rate limits and the forms' spam check.
   - Passwords: scrypt (Node's own crypto), a random salt each; compared in constant time.
   - Tokens (sessions, e-mailed links): 32 random bytes; only their SHA-256 is stored, so a copy of the database
     opens no account.
   - Rate limits: counted per key and time window in the database (shared by every process of the app).
   - Spam: a small proof-of-work puzzle the visitor's browser solves while they type (no picture to read, nothing
     sent to another company), plus the hidden field bots fill and the rate limit. */
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { config } from './config.js'
import { one, run, q } from './db.js'
import type { Request } from 'express'
import { HttpError, ipOf, SHARED } from './util.js'

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>
const N = 1 << 15, R = 8, P = 1, LEN = 32

/* Each password check takes 32 MB and about a tenth of a second: at most two run at once, the next few wait their
   turn, and a crowd beyond that is asked to try again, so a flood of guesses cannot use up the server's memory. */
const AT_ONCE = 2, QUEUE = 40
let running = 0
const queue: (() => void)[] = []
async function inTurn<T>(fn: () => Promise<T>): Promise<T> {
  if (running < AT_ONCE) running++
  else {
    if (queue.length >= QUEUE) throw new HttpError(503, 'The server is busy. Please try again in a minute.')
    await new Promise<void>((go) => queue.push(go))       // the check that finishes hands its turn over
  }
  try { return await fn() } finally {
    const next = queue.shift()
    if (next) next()
    else running--
  }
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const key = await inTurn(() => scrypt(pw.normalize('NFKC'), salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }))
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // as long as a real check, so the answer's timing does not say whether the account exists
    await inTurn(() => scrypt(pw, crypto.randomBytes(16), LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }))
    return false
  }
  const [alg, n, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !key) return false
  const want = Buffer.from(key, 'base64url')
  const got = await inTurn(() => scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'base64url'), want.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  }))
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}

/** What a new password must be: long enough, not just the e-mail address. */
export function passwordProblem(pw: string, email = ''): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.'
  if (pw.length > 200) return 'Use at most 200 characters.'
  if (email && pw.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length > 3) {
    return 'Choose a password that does not contain your e-mail address.'
  }
  if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|password|qwertyuiop)/i.test(pw)) return 'Choose a password that is harder to guess.'
  return null
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
export const hmac = (s: string) => crypto.createHmac('sha256', config.secret).update(s).digest('base64url')
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
/** A short code for a visitor's address (rate limits): never the address itself. */
export const ipKey = (ip: string) => hmac('ip|' + ip).slice(0, 16)

/* ---- rate limits ------------------------------------------------------------------------------------------------ */

/** The start of the current window, in seconds (windows of different lengths keep separate keys). */
const windowStart = (sec: number) => Math.floor(Date.now() / 1000 / sec) * sec

/** Counts one go at `key` in the current window; false when the limit is reached (the go is not counted then). */
export function allow(key: string, limit: number, windowSec: number): boolean {
  const w = windowStart(windowSec)
  const row = one<{ count: number }>('SELECT count FROM throttle WHERE key = ? AND window = ?', key, w)
  if (row && row.count >= limit) return false
  run('INSERT INTO throttle (key, window, count) VALUES (?, ?, 1) ON CONFLICT (key, window) DO UPDATE SET count = count + 1', key, w)
  return true
}
/** How many goes at `key` in the current window (without counting one). */
export function used(key: string, windowSec: number): number {
  const w = windowStart(windowSec)
  return one<{ count: number }>('SELECT count FROM throttle WHERE key = ? AND window = ?', key, w)?.count ?? 0
}
export function limit(key: string, max: number, windowSec: number, message: string) {
  if (!allow(key, max, windowSec)) throw new HttpError(429, message)
}
/** Counts one go at `key` in one step, and says how many there have been in this window, this one included (two
    requests at the same moment can never both read the old count). */
export function bump(key: string, windowSec: number): number {
  return one<{ count: number }>(
    'INSERT INTO throttle (key, window, count) VALUES (?, ?, 1) ON CONFLICT (key, window) DO UPDATE SET count = count + 1 RETURNING count',
    key, windowStart(windowSec))?.count ?? 1
}
/** Takes one go back (it turned out to be a right one). */
export function unbump(key: string, windowSec: number) {
  run('UPDATE throttle SET count = MAX(count - 1, 0) WHERE key = ? AND window = ?', key, windowStart(windowSec))
}
/** Forgets every go at `key` (a password was just reset: the wrong ones before it no longer count). */
export function forget(key: string) {
  run('DELETE FROM throttle WHERE key = ?', key)
}

/** A visitor's key for the limits, and their size: where the server cannot tell visitors apart (all of them are
    SHARED, util.ts), a limit made for one person is made for a crowd. */
export function visitor(req: Request): { key: string; times: number } {
  const ip = ipOf(req)
  return { key: ipKey(ip), times: ip === SHARED ? 30 : 1 }
}
/** Counts one go of the whole site at something (auto-replies, stored uploads); false when the day's or hour's
    share is used up. */
export const siteAllows = (what: string, max: number, windowSec: number) => allow(`site:${what}`, max, windowSec)

/* ---- the forms' spam check (proof of work) ---------------------------------------------------------------------------- */

const POW_BITS = 15            // about 33 000 tries on average: a fraction of a second on a phone
const POW_TTL = 30 * 60        // a puzzle is good for half an hour

export function powChallenge() {
  const id = randomToken(12)
  const expires = Math.floor(Date.now() / 1000) + POW_TTL
  const salt = randomToken(12)
  const sig = hmac(`${id}.${salt}.${POW_BITS}.${expires}`)
  return { id, salt, bits: POW_BITS, expires, sig }
}

function leadingZeroBits(buf: Buffer): number {
  let n = 0
  for (const b of buf) {
    if (b === 0) { n += 8; continue }
    n += Math.clz32(b) - 24
    break
  }
  return n
}

/** Checks a solved puzzle ("id.salt.bits.expires.sig.nonce") once: a solution cannot be used twice. */
export function powCheck(token: unknown): boolean {
  if (typeof token !== 'string' || token.length > 300) return false
  const parts = token.split('.')
  if (parts.length !== 6) return false
  const [id, salt, bits, expires, sig, nonce] = parts
  if (!safeEqual(sig, hmac(`${id}.${salt}.${bits}.${expires}`))) return false
  const exp = Number(expires)
  if (!(exp > Date.now() / 1000) || Number(bits) < POW_BITS) return false
  const h = crypto.createHash('sha256').update(`${salt}${nonce}`).digest()
  if (leadingZeroBits(h) < Number(bits)) return false
  // once only
  q('DELETE FROM pow_used WHERE expires < ?').run(Math.floor(Date.now() / 1000))
  try {
    run('INSERT INTO pow_used (id, expires) VALUES (?, ?)', id, exp)
  } catch {
    return false
  }
  return true
}

/** Housekeeping: old rate-limit windows and spent puzzles. */
export function sweep() {
  const t = Math.floor(Date.now() / 1000)
  run('DELETE FROM throttle WHERE window < ?', t - 2 * 86400)
  run('DELETE FROM pow_used WHERE expires < ?', t)
}
