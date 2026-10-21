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
import { HttpError } from './util.js'

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>
const N = 1 << 15, R = 8, P = 1, LEN = 32

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(pw.normalize('NFKC'), salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    // as long as a real check, so the answer's timing does not say whether the account exists
    await scrypt(pw, crypto.randomBytes(16), LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 })
    return false
  }
  const [alg, n, r, p, salt, key] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !key) return false
  const want = Buffer.from(key, 'base64url')
  const got = await scrypt(pw.normalize('NFKC'), Buffer.from(salt, 'base64url'), want.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  })
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
