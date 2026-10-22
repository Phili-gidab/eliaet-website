/* The members' area: the directory (signed-in members of an active company, and the Secretariat), a member's own
   company profile (changes go to the Secretariat for review), the people of the company, and what ELIA shares with
   members: notices, documents and opportunities. */
import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { config } from '../config.js'
import { one, all, run, now, toJson, fromJson } from '../db.js'
import { send, link, lines } from '../mail.js'
import { store, fileRef, removeFile, MAX_MB } from '../files.js'
import { requireUser, me } from '../session.js'
import { limit } from '../security.js'
import { HttpError, notFound, forbidden, parse, wrap, req as required, opt, email } from '../util.js'
import { companyOut, directory, profileSchema, diff } from '../companies.js'
import { NOTICE_KINDS, OPPORTUNITY_KINDS } from '../../../shared/options.js'

export const member = Router()
member.use(requireUser)

/** The signed-in person's company (members), checked to be active. The Secretariat passes. */
function activeMember(req: Request) {
  const u = me(req)
  if (u.role === 'secretariat') return null
  const c = u.company_id ? one('SELECT * FROM companies WHERE id = ?', u.company_id) : null
  if (!c) throw forbidden('Your account is not linked to a member company yet. Please contact the ELIA Secretariat.')
  if (c.status !== 'active') throw forbidden('Your company’s membership is not active at the moment. Please contact the ELIA Secretariat.')
  return c
}

member.get('/directory', wrap((req, res) => {
  activeMember(req)
  const s = (k: string) => (typeof req.query[k] === 'string' ? String(req.query[k]) : undefined)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json(directory({
    q: s('q'), category: s('category'), size: s('size'), region: s('region'), export: s('export'), cert: s('cert'),
    page: Number(s('page') ?? 1) || 1, sort: s('sort') === 'updated' ? 'updated' : 'name',
    includeHidden: me(req).role === 'secretariat' && s('all') === '1',
  }))
}))

member.get('/directory/:slug', wrap((req, res) => {
  activeMember(req)
  const c = one('SELECT * FROM companies WHERE slug = ?', String(req.params.slug))
  const sec = me(req).role === 'secretariat'
  if (!c || c.status === 'archived' || (!sec && (c.status !== 'active' || !c.listed))) throw notFound('This member is not in the directory.')
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({ company: companyOut(c, sec) })
}))

/* ---- my company ---- */

member.get('/me', wrap((req, res) => {
  const u = me(req)
  const c = u.company_id ? one('SELECT * FROM companies WHERE id = ?', u.company_id) : null
  const pending = c ? one(`SELECT id, data, created_at FROM profile_changes WHERE company_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`, c.id) : null
  const last = c ? one(`SELECT status, note, decided_at FROM profile_changes WHERE company_id = ? AND status IN ('approved', 'rejected') ORDER BY id DESC LIMIT 1`, c.id) : null
  res.setHeader('Cache-Control', 'private, no-store')
  // the proposal waiting for review, with its pictures resolved, so the form can show what was sent
  const proposed = pending ? fromJson<Record<string, unknown>>(pending.data, {}) : null
  if (proposed && Array.isArray(proposed.photos)) proposed.photos = (proposed.photos as number[]).map((id) => fileRef(id)).filter(Boolean)
  if (proposed && 'logo_file_id' in proposed) proposed.logo = proposed.logo_file_id ? fileRef(proposed.logo_file_id as number)?.url ?? null : null
  res.json({
    company: c ? companyOut(c, true) : null,
    pending: pending ? { id: pending.id, fields: Object.keys(fromJson(pending.data, {})), data: proposed, created_at: pending.created_at } : null,
    lastDecision: last ?? null,
    usersPerCompany: config.usersPerCompany,
  })
}))

/** A member's pictures: a logo and up to four photos, 4 MB each, and the profile's short fields. */
const pictures = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB.image * 1024 * 1024, files: 5, fields: 40, fieldSize: 32 * 1024 },
})
/** Before the pictures are read: only a member, and not too many changes a day. */
function mayPropose(req: Request, _res: Response, next: NextFunction) {
  try {
    const u = me(req)
    if (u.role !== 'member' || !u.company_id) throw forbidden()
    limit(`change:${u.company_id}`, 20, 86400, 'That is a lot of changes for one day. Please try again tomorrow.')
    next()
  } catch (e) { next(e) }
}

/** A member proposes changes to their company's profile (with a new logo and photos, if any). */
member.post('/me/company', mayPropose, pictures.fields([{ name: 'logo', maxCount: 1 }, { name: 'photos', maxCount: 4 }]), wrap(async (req, res) => {
  const u = me(req)
  if (u.role !== 'member' || !u.company_id) throw forbidden()
  const c = one('SELECT * FROM companies WHERE id = ?', u.company_id)
  if (!c || c.status === 'archived') throw forbidden()
  const d = parse(profileSchema, req.body)
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>
  const next: Record<string, unknown> = { ...d }
  // a proposal still waiting: the pictures sent with it can be kept in this one
  const waiting = one(`SELECT data FROM profile_changes WHERE company_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`, c.id)
  const before = fromJson<Record<string, unknown>>(waiting?.data, {})
  // photos kept (by id) from the current set or the waiting proposal, in the order shown, then any new ones; four at most
  const keep = z.array(z.coerce.number().int()).catch([]).parse(
    typeof req.body.keepPhotos === 'string' ? req.body.keepPhotos.split(',').filter(Boolean) : req.body.keepPhotos ?? [])
  const current = fromJson<number[]>(c.photos, [])
  const known = new Set([...current, ...((before.photos as number[] | undefined) ?? [])])
  let photos = req.body.keepPhotos === undefined ? [...current] : keep.filter((id, i) => known.has(id) && keep.indexOf(id) === i)
  // four at most: checked before anything is stored, so no picture is kept that no profile uses
  if (photos.length + (files.photos?.length ?? 0) > 4) {
    throw new HttpError(422, 'A profile has up to four photos. Remove one before adding another.', { photos: 'Up to four photos' })
  }
  for (const f of files.photos ?? []) photos.push(store(f, 'image', 'members', u.id, 'photos'))
  if (JSON.stringify(photos) !== JSON.stringify(current)) next.photos = photos
  if (files.logo?.[0]) next.logo_file_id = store(files.logo[0], 'image', 'members', u.id, 'logo')
  else if (req.body.removeLogo === 'true') next.logo_file_id = null
  else if ('logo_file_id' in before) next.logo_file_id = before.logo_file_id
  const changes = diff(c, next as never)
  if (!Object.keys(changes).length) throw new HttpError(422, 'Nothing has changed.')
  // the newest proposal replaces one still waiting; the pictures that came only with that one go
  if (waiting) cleanWithdrawnFiles(waiting.data, [...current, c.logo_file_id, ...photos, next.logo_file_id as number].filter((x): x is number => typeof x === 'number'))
  run(`UPDATE profile_changes SET status = 'withdrawn', decided_at = ? WHERE company_id = ? AND status = 'pending'`, now(), c.id)
  const id = run(`INSERT INTO profile_changes (company_id, user_id, data, status, created_at) VALUES (?, ?, ?, 'pending', ?)`,
    c.id, u.id, toJson(changes), now()).id
  await send({
    to: config.teams.members,
    subject: `[ELIA website] Profile change · ${c.name}`,
    text: `${u.name} of ${c.name} has proposed changes to the company’s directory profile: ${Object.keys(changes).join(', ')}.\n\nReview them in the back office: ${link('/admin#changes/' + id)}`,
  })
  res.status(201).json({ ok: true, id, fields: Object.keys(changes) })
}))

member.post('/me/company/withdraw', wrap((req, res) => {
  const u = me(req)
  if (!u.company_id) throw forbidden()
  const c = one('SELECT logo_file_id, photos FROM companies WHERE id = ?', u.company_id)
  const keep = [...fromJson<number[]>(c?.photos, []), c?.logo_file_id].filter((x): x is number => typeof x === 'number')
  for (const w of all(`SELECT data FROM profile_changes WHERE company_id = ? AND status = 'pending'`, u.company_id)) cleanWithdrawnFiles(w.data, keep)
  run(`UPDATE profile_changes SET status = 'withdrawn', decided_at = ? WHERE company_id = ? AND status = 'pending'`, now(), u.company_id)
  res.json({ ok: true })
}))

/* ---- the company's people ---- */

member.get('/me/team', wrap((req, res) => {
  const u = me(req)
  if (!u.company_id) return void res.json({ users: [], pending: [], max: config.usersPerCompany })
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({
    users: all(`SELECT id, name, position, email, status, last_login_at FROM users WHERE company_id = ? AND role = 'member' ORDER BY name`, u.company_id),
    pending: all(`SELECT id, name, position, email, created_at FROM access_requests WHERE company_id = ? AND status = 'pending' ORDER BY id DESC`, u.company_id),
    max: config.usersPerCompany,
  })
}))

member.post('/me/team/invite', wrap(async (req, res) => {
  const u = me(req)
  if (u.role !== 'member' || !u.company_id) throw forbidden()
  activeMember(req)
  const d = parse(z.object({ name: required(120), position: opt(120), email, phone: opt(40) }), req.body)
  limit(`invite:${u.company_id}`, 10, 86400, 'Too many invitations today. Please try again tomorrow.')
  const users = Number(one(`SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = 'member' AND status = 'active'`, u.company_id)?.n ?? 0)
  const waiting = Number(one(`SELECT COUNT(*) AS n FROM access_requests WHERE company_id = ? AND status = 'pending'`, u.company_id)?.n ?? 0)
  if (users + waiting >= config.usersPerCompany) {
    throw new HttpError(422, `A member company can have up to ${config.usersPerCompany} people signed up. Ask the Secretariat to remove someone first.`)
  }
  if (one('SELECT id FROM users WHERE email = ?', d.email)) throw new HttpError(422, 'That address already has an account.', { email: 'Already has an account' })
  const c = one('SELECT name FROM companies WHERE id = ?', u.company_id)!
  const id = run(`INSERT INTO access_requests (company_id, company_name, name, position, email, phone, invited_by, status, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`, u.company_id, c.name, d.name, d.position, d.email, d.phone, u.id, now()).id
  await send({
    to: config.teams.members,
    subject: `[ELIA website] Access request · ${d.name}, ${c.name}`,
    text: `${u.name} of ${c.name} asks for an account for a colleague:\n\n${lines([['Name', d.name], ['Position', d.position], ['E-mail', d.email], ['Phone', d.phone]])}\n\nApprove or decline it in the back office: ${link('/admin#access/' + id)}`,
  })
  res.status(201).json({ ok: true })
}))

/* ---- what ELIA shares with members ---- */

member.get('/me/notices', wrap((req, res) => {
  activeMember(req)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({
    items: all('SELECT id, title, kind, body, file_id, published_on FROM notices WHERE published_on <= ? ORDER BY published_on DESC, id DESC LIMIT 100', now().slice(0, 10))
      .map((n) => ({ ...n, kindLabel: NOTICE_KINDS[n.kind as keyof typeof NOTICE_KINDS], file: fileRef(n.file_id) })),
  })
}))

member.get('/me/opportunities', wrap((req, res) => {
  activeMember(req)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({
    items: all('SELECT id, title, kind, body, deadline, link_url, file_id, published_on FROM opportunities WHERE published_on <= ? ORDER BY published_on DESC, id DESC LIMIT 100', now().slice(0, 10))
      .map((o) => ({ ...o, kindLabel: OPPORTUNITY_KINDS[o.kind as keyof typeof OPPORTUNITY_KINDS], file: fileRef(o.file_id), closed: !!o.deadline && o.deadline < now().slice(0, 10) })),
  })
}))

member.get('/me/documents', wrap((req, res) => {
  activeMember(req)
  res.setHeader('Cache-Control', 'private, no-store')
  res.json({
    items: all(`SELECT id, title, type, year, summary, file_id, link_url, updated_at FROM publications WHERE status = 'published' AND access = 'members' ORDER BY COALESCE(year, 0) DESC, id DESC`)
      .map((p) => ({ ...p, file: fileRef(p.file_id) })),
  })
}))

/** Removes a photo or logo that was uploaded with a proposal that was then withdrawn (housekeeping). */
export function cleanWithdrawnFiles(changeData: string, keepIds: number[]) {
  const d = fromJson<Record<string, unknown>>(changeData, {})
  const ids = [...((d.photos as number[]) ?? []), d.logo_file_id as number].filter((x): x is number => typeof x === 'number')
  for (const id of ids) if (!keepIds.includes(id)) removeFile(id)
}
