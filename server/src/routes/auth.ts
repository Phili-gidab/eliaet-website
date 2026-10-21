/* Signing in and out, passwords, and asking for access.
   - A member company's people ask for access; the Secretariat approves them (up to USERS_PER_COMPANY a company);
     approval e-mails a link to set a password. Nobody, the Secretariat included, ever sees or sends a password.
   - Five wrong passwords in a row lock the account for fifteen minutes; each connection and each address is also
     rate-limited. Messages never say whether an address has an account. */
import { Router } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { one, run, now, tx } from '../db.js'
import { send, link } from '../mail.js'
import { hashPassword, verifyPassword, passwordProblem, randomToken, sha256, limit, ipKey, powCheck } from '../security.js'
import { startSession, endSession, endAllSessions, requireUser, me } from '../session.js'
import { HttpError, parse, wrap, req as required, opt, email, ipOf, slugify } from '../util.js'

export const auth = Router()

const LOCK_AFTER = 5
const LOCK_MIN = 15

/** What the pages know about the person signed in. */
export function sessionInfo(userId: number) {
  const u = one(`SELECT u.id, u.email, u.name, u.position, u.phone, u.role, u.company_id,
                        c.name AS company_name, c.slug AS company_slug, c.status AS company_status
                   FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = ?`, userId)
  if (!u) return null
  return {
    id: u.id, email: u.email, name: u.name, position: u.position, phone: u.phone, role: u.role,
    company: u.company_id ? { id: u.company_id, name: u.company_name, slug: u.company_slug, status: u.company_status } : null,
  }
}

auth.get('/session', (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  const s = req.session
  res.json({ user: s ? sessionInfo(s.user.id) : null, csrf: s?.csrf ?? null })
})

auth.post('/login', wrap(async (req, res) => {
  const d = parse(z.object({ email, password: z.string().min(1, 'Required').max(200) }), req.body)
  const ip = ipKey(ipOf(req))
  limit(`login:ip:${ip}`, 30, 900, 'Too many attempts from this connection. Please wait fifteen minutes and try again.')
  limit(`login:em:${sha256(d.email)}`, 12, 900, 'Too many attempts for this address. Please wait fifteen minutes, or reset your password.')
  const u = one('SELECT id, email, password_hash, status, failed_logins, locked_until FROM users WHERE email = ?', d.email)
  if (u?.locked_until && u.locked_until > now()) {
    const min = Math.max(1, Math.ceil((Date.parse(u.locked_until) - Date.now()) / 60000))
    throw new HttpError(429, `Too many wrong passwords. Please try again in ${min} minute${min === 1 ? '' : 's'}, or reset your password.`)
  }
  const ok = await verifyPassword(d.password, u?.password_hash)
  if (!u || !ok || u.status !== 'active') {
    if (u) {
      const n = Number(u.failed_logins) + 1
      const lock = n >= LOCK_AFTER ? new Date(Date.now() + LOCK_MIN * 60000).toISOString() : null
      run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', lock ? 0 : n, lock, u.id)
    }
    throw new HttpError(401, 'That e-mail address and password do not match an active account.', { password: 'Check it and try again' })
  }
  const s = startSession(req, res, u.id)
  res.json({ user: sessionInfo(u.id), csrf: s.csrf })
}))

auth.post('/logout', (req, res) => {
  endSession(req, res)
  res.json({ ok: true })
})

/* ---- e-mailed links: set a password (new account) or reset it ---- */

export function issueLink(userId: number, kind: 'set_password' | 'reset_password'): string {
  const token = randomToken(32)
  const hours = kind === 'set_password' ? 72 : 1
  run('UPDATE tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL', now(), userId)
  run('INSERT INTO tokens (id, user_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    sha256(token), userId, kind, now(), new Date(Date.now() + hours * 3600 * 1000).toISOString())
  return link(`/members/password?token=${token}`)
}

/** E-mails a person the link to set their password (their account has just been approved or created). */
export async function sendWelcome(userId: number) {
  const u = one('SELECT u.name, u.email, u.role, c.name AS company FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = ?', userId)
  if (!u) return false
  const url = issueLink(userId, 'set_password')
  const what = u.role === 'secretariat'
    ? 'An account has been made for you in the ELIA website’s back office, where the Secretariat looks after members, applications, news and the forms.'
    : `Your access to the ELIA members’ area${u.company ? ` for ${u.company}` : ''} has been approved: the members directory, your company’s profile, member notices, documents and opportunities.`
  return send({
    to: u.email,
    subject: u.role === 'secretariat' ? 'Your ELIA back office account' : 'Your access to the ELIA members’ area',
    text: `Dear ${u.name},\n\n${what}\n\nSet your password here (the link works for 72 hours and only once):\n${url}\n\nThen sign in at ${link('/members/login')} with this e-mail address (${u.email}).`,
  })
}

auth.get('/token', wrap((req, res) => {
  const t = String(req.query.token ?? '')
  const row = t ? one(`SELECT t.kind, t.expires_at, t.used_at, u.name, u.email, u.status FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.id = ?`, sha256(t)) : null
  if (!row || row.used_at || row.expires_at < now() || row.status !== 'active') {
    return void res.json({ ok: false, error: 'This link has expired or has already been used. Ask for a new one below.' })
  }
  res.json({ ok: true, kind: row.kind, name: row.name, email: row.email })
}))

auth.post('/password', wrap(async (req, res) => {
  const d = parse(z.object({ token: z.string().min(10).max(100), password: z.string().max(200) }), req.body)
  limit(`pw:ip:${ipKey(ipOf(req))}`, 20, 3600, 'Too many attempts. Please try again later.')
  const row = one(`SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email, u.status FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.id = ?`, sha256(d.token))
  if (!row || row.used_at || row.expires_at < now() || row.status !== 'active') {
    throw new HttpError(400, 'This link has expired or has already been used. Ask for a new one.')
  }
  const problem = passwordProblem(d.password, row.email)
  if (problem) throw new HttpError(422, problem, { password: problem })
  const hash = await hashPassword(d.password)
  tx(() => {
    run('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = ? WHERE id = ?', hash, now(), row.user_id)
    run('UPDATE tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL', now(), row.user_id)
    endAllSessions(row.user_id)
  })
  const s = startSession(req, res, row.user_id)
  res.json({ user: sessionInfo(row.user_id), csrf: s.csrf })
}))

auth.post('/forgot', wrap(async (req, res) => {
  const d = parse(z.object({ email }), req.body)
  if (!powCheck(req.body?.pow)) throw new HttpError(400, 'The form’s spam check did not finish. Please wait a moment and send it again.')
  limit(`forgot:ip:${ipKey(ipOf(req))}`, 6, 3600, 'Too many requests from this connection. Please try again in an hour.')
  const u = one('SELECT id, name, email, status FROM users WHERE email = ?', d.email)
  // at most three links an hour to one address, and the same answer either way
  if (u && u.status === 'active' && limitQuiet(`forgot:em:${sha256(d.email)}`, 3, 3600)) {
    const url = issueLink(u.id, 'reset_password')
    await send({
      to: u.email,
      subject: 'Reset your ELIA password',
      text: `Dear ${u.name},\n\nSomeone (we hope you) asked to reset the password of your ELIA account.\n\nChoose a new password here (the link works for one hour and only once):\n${url}\n\nIf it was not you, ignore this e-mail: your password stays as it is.`,
    })
  }
  res.json({ ok: true })
}))

function limitQuiet(key: string, max: number, windowSec: number): boolean {
  try { limit(key, max, windowSec, ''); return true } catch { return false }
}

auth.post('/change-password', requireUser, wrap(async (req, res) => {
  const d = parse(z.object({ current: z.string().max(200), password: z.string().max(200) }), req.body)
  const u = me(req)
  limit(`chpw:${u.id}`, 10, 3600, 'Too many attempts. Please try again later.')
  const row = one('SELECT password_hash FROM users WHERE id = ?', u.id)
  if (!(await verifyPassword(d.current, row?.password_hash))) throw new HttpError(422, 'Your current password is not right.', { current: 'Not right' })
  const problem = passwordProblem(d.password, u.email)
  if (problem) throw new HttpError(422, problem, { password: problem })
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', await hashPassword(d.password), now(), u.id)
  endAllSessions(u.id, req.session!.id)
  res.json({ ok: true })
}))

/* ---- asking for access ---- */

auth.post('/request-access', wrap(async (req, res) => {
  if (String(req.body?.website_url ?? '').trim()) return void res.status(201).json({ ok: true })
  const d = parse(z.object({
    companyName: required(200), name: required(120), position: opt(120), email, phone: opt(40), message: opt(2000),
  }), req.body)
  if (!powCheck(req.body?.pow)) throw new HttpError(400, 'The form’s spam check did not finish. Please wait a moment and send it again.')
  limit(`access:ip:${ipKey(ipOf(req))}`, 5, 3600, `Too many requests from this connection. Please try again in an hour, or e-mail ${config.contactEmail}.`)
  const company = one<{ id: number; name: string }>(
    `SELECT id, name FROM companies WHERE status <> 'archived' AND (name = ? COLLATE NOCASE OR slug = ?)`,
    d.companyName, slugify(d.companyName))
  const existing = one('SELECT id FROM users WHERE email = ?', d.email)
  const id = run(`INSERT INTO access_requests (company_id, company_name, name, position, email, phone, message, status, note, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    company?.id ?? null, d.companyName, d.name, d.position, d.email, d.phone, d.message,
    existing ? 'This address already has an account.' : null, now()).id
  await send({
    to: config.teams.members,
    subject: `[ELIA website] Access request · ${d.name}, ${d.companyName}`,
    text: `${d.name}${d.position ? ` (${d.position})` : ''} of ${d.companyName} asks for access to the members’ area.\n` +
      `${company ? `This matches the member ${company.name}.` : 'No member company of that name is on file: check it before approving.'}\n` +
      `${existing ? 'Note: this e-mail address already has an account.\n' : ''}\nE-mail: ${d.email}\nPhone: ${d.phone || '-'}\n${d.message ? `\n${d.message}\n` : ''}\nApprove or decline it in the back office: ${link('/admin#access/' + id)}`,
    replyTo: d.email,
  })
  await send({
    to: d.email,
    subject: 'Your request for access to the ELIA members’ area',
    text: `Dear ${d.name},\n\nThank you. The ELIA Secretariat will check your request for access for ${d.companyName} and e-mail you a link to set your password once it is approved.`,
  })
  res.status(201).json({ ok: true })
}))
