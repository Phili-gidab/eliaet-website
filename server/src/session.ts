/* Who is signed in. A session is a random token in a cookie (HttpOnly, Secure and __Host- in production, SameSite
   Lax); the database keeps only its hash, who it belongs to, and a CSRF token the pages send back on every change.
   Every change also has to come from the site itself (its Origin), so another site cannot post on someone's behalf. */
import type { Request, Response, NextFunction } from 'express'
import { config } from './config.js'
import { one, run, now } from './db.js'
import { randomToken, sha256, safeEqual } from './security.js'
import { HttpError, forbidden } from './util.js'

export interface User {
  id: number
  email: string
  name: string
  position: string | null
  phone: string | null
  role: 'member' | 'secretariat'
  company_id: number | null
  status: 'active' | 'disabled'
}
export interface Session { id: string; csrf: string; user: User }

declare module 'express-serve-static-core' {
  interface Request { session?: Session | null }
}

const DAY = 86400 * 1000
const MAX_DAYS = 30

export function cookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k || k in out) continue
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()) } catch { out[k] = part.slice(i + 1).trim() }
  }
  return out
}

function setCookie(res: Response, value: string, maxAgeSec: number) {
  const attrs = [`${config.cookie}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`]
  if (config.secureCookie) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

/** A hint the pages' script can read ("m" member, "s" Secretariat), so the header says "My account" without asking
    the server. It opens nothing: every request is still checked against the session itself. */
export const HINT = 'elia_in'
function setHint(res: Response, role: 'm' | 's' | '', maxAgeSec: number) {
  const attrs = [`${HINT}=${role}`, 'Path=/', 'SameSite=Lax', `Max-Age=${maxAgeSec}`]
  if (config.secureCookie) attrs.push('Secure')
  res.append('Set-Cookie', attrs.join('; '))
}

/** Loads the session (if any) for every request under /api. Refreshes its expiry at most once an hour. */
export function loadSession(req: Request, res: Response, next: NextFunction) {
  req.session = null
  const jar = cookies(req)
  const token = jar[config.cookie]
  if (token && token.length < 100) {
    const id = sha256(token)
    const row = one(
      `SELECT s.id, s.csrf, s.expires_at, s.seen_at, s.created_at, u.id AS uid, u.email, u.name, u.position, u.phone, u.role,
              u.company_id, u.status
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`, id)
    if (row && row.expires_at > now() && row.status === 'active') {
      req.session = {
        id, csrf: row.csrf,
        user: { id: row.uid, email: row.email, name: row.name, position: row.position, phone: row.phone, role: row.role, company_id: row.company_id, status: row.status },
      }
      if (Date.now() - Date.parse(row.seen_at) > 3600 * 1000) {
        const hardEnd = Date.parse(row.created_at) + MAX_DAYS * DAY
        const exp = new Date(Math.min(Date.now() + config.sessionDays * DAY, hardEnd)).toISOString()
        run('UPDATE sessions SET seen_at = ?, expires_at = ? WHERE id = ?', now(), exp, id)
      }
    } else if (row) {
      run('DELETE FROM sessions WHERE id = ?', id)
    }
  }
  if (!req.session && jar[HINT]) setHint(res, '', 0)       // signed out elsewhere, or expired: the header says so
  next()
}

/** Signs a person in: a new session (a new token, so an old one can never be carried over). */
export function startSession(req: Request, res: Response, userId: number): Session {
  const token = randomToken(32)
  const id = sha256(token)
  const csrf = randomToken(24)
  const exp = new Date(Date.now() + config.sessionDays * DAY).toISOString()
  run('INSERT INTO sessions (id, user_id, csrf, created_at, seen_at, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, userId, csrf, now(), now(), exp, '', String(req.headers['user-agent'] ?? '').slice(0, 200))
  run('UPDATE users SET last_login_at = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', now(), userId)
  setCookie(res, token, config.sessionDays * 86400)
  const u = one<User>('SELECT id, email, name, position, phone, role, company_id, status FROM users WHERE id = ?', userId)!
  setHint(res, u.role === 'secretariat' ? 's' : 'm', config.sessionDays * 86400)
  return (req.session = { id, csrf, user: u })
}

export function endSession(req: Request, res: Response) {
  if (req.session) run('DELETE FROM sessions WHERE id = ?', req.session.id)
  req.session = null
  setCookie(res, '', 0)
  setHint(res, '', 0)
}

/** Ends every session of a person (after a password change, or when their access is taken away). */
export function endAllSessions(userId: number, keep?: string) {
  if (keep) run('DELETE FROM sessions WHERE user_id = ? AND id <> ?', userId, keep)
  else run('DELETE FROM sessions WHERE user_id = ?', userId)
}

/** Changes must come from the site's own pages: the Origin (or the Referer) has to be one of ours. */
/** Posts that carry their own key and can do nothing without it, so they need not come from the site's own pages:
    the e-mailed unsubscribe link's button (a mail program may also post it). */
const KEYED = new Set(['/forms/unsubscribe'])

export function sameOrigin(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if (KEYED.has(req.path)) return next()
  const host = String(req.headers.host ?? '')
  const from = String(req.headers.origin ?? '') || (() => {
    try { return new URL(String(req.headers.referer ?? '')).origin } catch { return '' }
  })()
  const ok = !from
    ? !config.isProd                                     // no Origin at all: only a script outside a browser would do that
    : config.origins.includes(from) || (() => { try { return new URL(from).host === host } catch { return false } })()
  if (!ok) return next(new HttpError(403, 'This request did not come from the ELIA site.'))
  next()
}

/** For signed-in changes: the CSRF token from the session has to come back in the X-CSRF header. */
function checkCsrf(req: Request) {
  if (req.method === 'GET' || req.method === 'HEAD') return
  const sent = String(req.headers['x-csrf'] ?? '')
  if (!req.session || !sent || !safeEqual(sent, req.session.csrf)) {
    throw new HttpError(403, 'Your session has changed. Please reload the page and try again.')
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.session) return next(new HttpError(401, 'Please sign in.'))
  try { checkCsrf(req) } catch (e) { return next(e) }
  next()
}

export function requireSecretariat(req: Request, _res: Response, next: NextFunction) {
  if (!req.session) return next(new HttpError(401, 'Please sign in.'))
  if (req.session.user.role !== 'secretariat') return next(forbidden('This is for the ELIA Secretariat.'))
  try { checkCsrf(req) } catch (e) { return next(e) }
  next()
}

export const me = (req: Request) => req.session!.user
