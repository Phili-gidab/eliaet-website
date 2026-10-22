/* The Secretariat's back office: approvals (membership applications, access requests, profile changes), the member
   companies and their people, what ELIA publishes (news, events, publications, member notices and opportunities),
   and everything the forms bring in. Secretariat accounts only; every change is recorded in the audit log. */
import { Router, type Request } from 'express'
import { z } from 'zod'
import { config } from '../config.js'
import { one, all, run, now, tx, fromJson, type Row } from '../db.js'
import { send, link } from '../mail.js'
import { upload, store, fileRef, removeFile, setAccess, type Access, type Kind } from '../files.js'
import { requireSecretariat, me, endAllSessions } from '../session.js'
import { sendWelcome } from './auth.js'
import { cleanWithdrawnFiles } from './member.js'
import { HttpError, notFound, parse, wrap, csv, parseCsv, opt, req as required, email, day, url, slugify } from '../util.js'
import { companyOut, adminSchema, applyToCompany, createCompany, freeSlug } from '../companies.js'
import {
  CATEGORIES, SIZES, REGIONS, EXPORT_STATUS, INQUIRIES, POST_CATEGORIES, PUBLICATION_TYPES, NOTICE_KINDS, OPPORTUNITY_KINDS, TEAMS,
} from '../../../shared/options.js'

export const admin = Router()
admin.use(requireSecretariat)

const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]
const id = (req: Request) => {
  const n = Number(req.params.id)
  if (!Number.isInteger(n) || n < 1) throw notFound()
  return n
}
function audit(req: Request, action: string, subject: string, subjectId: number | null, detail?: string) {
  run('INSERT INTO audit (user_id, action, subject, subject_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    me(req).id, action, subject, subjectId, detail ?? null, now())
}
const page = (req: Request) => Math.max(1, Number(req.query.page ?? 1) || 1)
const qs = (req: Request, k: string) => (typeof req.query[k] === 'string' ? String(req.query[k]).trim() : '')
const like = (s: string) => '%' + s.replace(/[\\%_]/g, (m) => '\\' + m) + '%'

/* ---- overview ---- */

admin.get('/overview', wrap((_req, res) => {
  const n = (sql: string) => Number(one(sql)?.n ?? 0)
  res.json({
    applications: n(`SELECT COUNT(*) AS n FROM applications WHERE status IN ('new', 'reviewing')`),
    access: n(`SELECT COUNT(*) AS n FROM access_requests WHERE status = 'pending'`),
    changes: n(`SELECT COUNT(*) AS n FROM profile_changes WHERE status = 'pending'`),
    inquiries: n(`SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'`),
    members: n(`SELECT COUNT(*) AS n FROM companies WHERE status = 'active'`),
    users: n(`SELECT COUNT(*) AS n FROM users WHERE role = 'member' AND status = 'active'`),
    subscribers: n(`SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed_at IS NULL`),
    duesDue: n(`SELECT COUNT(*) AS n FROM companies WHERE status = 'active' AND (dues_paid_until IS NULL OR dues_paid_until < date('now'))`),
    recent: all(`SELECT a.action, a.subject, a.subject_id, a.detail, a.created_at, u.name AS who FROM audit a LEFT JOIN users u ON u.id = a.user_id
                 ORDER BY a.id DESC LIMIT 15`),
    options: { categories: CATEGORIES, sizes: SIZES, regions: REGIONS, exportStatus: EXPORT_STATUS, inquiries: INQUIRIES, teams: TEAMS,
      postCategories: POST_CATEGORIES, publicationTypes: PUBLICATION_TYPES, noticeKinds: NOTICE_KINDS, opportunityKinds: OPPORTUNITY_KINDS },
    usersPerCompany: config.usersPerCompany,
  })
}))

/* ---- membership applications ---- */

admin.get('/applications', wrap((req, res) => {
  const st = qs(req, 'status')
  res.json({
    items: all(`SELECT id, company_name, contact_name, email, category, status, company_id, created_at FROM applications
                ${st ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT 300`, ...(st ? [st] : [])),
  })
}))

admin.get('/applications/:id', wrap((req, res) => {
  const a = one('SELECT * FROM applications WHERE id = ?', id(req))
  if (!a) throw notFound()
  res.json({ ...a, data: fromJson(a.data, {}), licence: fileRef(a.licence_file_id) })
}))

admin.post('/applications/:id', wrap((req, res) => {
  const d = parse(z.object({ status: z.enum(['new', 'reviewing', 'declined']), note: opt(2000) }), req.body)
  const n = id(req)
  run('UPDATE applications SET status = ?, note = ?, decided_by = ?, decided_at = ? WHERE id = ?', d.status, d.note, me(req).id, now(), n)
  audit(req, `application ${d.status}`, 'application', n)
  res.json({ ok: true })
}))

/** Accepting an application makes the member company from it, and (if asked) invites its contact person. */
admin.post('/applications/:id/accept', wrap(async (req, res) => {
  const d = parse(z.object({ invite: z.boolean().default(true) }), req.body)
  const a = one('SELECT * FROM applications WHERE id = ?', id(req))
  if (!a) throw notFound()
  if (a.status === 'accepted' && a.company_id) throw new HttpError(422, 'This application has already been accepted.')
  const f = fromJson<Record<string, any>>(a.data, {})
  if (d.invite && one('SELECT id FROM users WHERE email = ?', a.email)) {
    throw new HttpError(422, `${a.email} already has an account. Accept without inviting, then link that account to the company.`)
  }
  const { companyId, userId } = tx(() => {
    const companyId = createCompany({
      name: a.company_name, category: a.category, size: f.size ?? null, region: f.region ?? null, address: f.address ?? '',
      products: f.products ?? '', year_established: f.yearEstablished ?? null, employees: f.employees ?? null,
      export_markets: f.exportMarkets ?? '', export_status: f.exportMarkets ? 'exporting' : null,
      contact_name: f.contactName ?? '', contact_position: f.position ?? '', phone: f.phone ?? '', email: a.email,
      member_since: new Date().getFullYear(),
    } as never)
    run(`UPDATE applications SET status = 'accepted', company_id = ?, decided_by = ?, decided_at = ? WHERE id = ?`, companyId, me(req).id, now(), a.id)
    let userId: number | null = null
    if (d.invite) {
      userId = run(`INSERT INTO users (email, name, position, phone, role, company_id, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'member', ?, 'active', ?, ?)`, a.email, a.contact_name, f.position ?? '', f.phone ?? '', companyId, now(), now()).id
    }
    return { companyId, userId }
  })
  if (userId) await sendWelcome(userId)
  audit(req, 'application accepted', 'company', companyId, a.company_name)
  res.json({ ok: true, companyId, userId })
}))

/* ---- access requests ---- */

admin.get('/access', wrap((req, res) => {
  const st = qs(req, 'status') || 'pending'
  res.json({
    items: all(`SELECT r.*, c.name AS matched_company, i.name AS invited_by_name FROM access_requests r
                LEFT JOIN companies c ON c.id = r.company_id LEFT JOIN users i ON i.id = r.invited_by
                ${st === 'all' ? '' : 'WHERE r.status = ?'} ORDER BY r.id DESC LIMIT 300`, ...(st === 'all' ? [] : [st])),
  })
}))

admin.post('/access/:id/approve', wrap(async (req, res) => {
  const d = parse(z.object({ company_id: z.coerce.number().int().positive('Choose the company') }), req.body)
  const r = one('SELECT * FROM access_requests WHERE id = ?', id(req))
  if (!r || r.status !== 'pending') throw new HttpError(422, 'This request has already been answered.')
  const c = one('SELECT id, name, status FROM companies WHERE id = ?', d.company_id)
  if (!c || c.status === 'archived') throw new HttpError(422, 'Choose a member company.', { company_id: 'Choose one' })
  const count = Number(one(`SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = 'member' AND status = 'active'`, c.id)?.n ?? 0)
  if (count >= config.usersPerCompany) {
    throw new HttpError(422, `${c.name} already has ${count} people signed up (the limit is ${config.usersPerCompany}). Disable one of them first.`)
  }
  const userId = tx(() => {
    const u = one<{ id: number; role: string; status: string; company_id: number | null; company: string | null }>(
      'SELECT u.id, u.role, u.status, u.company_id, c.name AS company FROM users u LEFT JOIN companies c ON c.id = u.company_id WHERE u.email = ?', r.email)
    let uid: number
    if (u) {
      if (u.role === 'secretariat') throw new HttpError(422, 'That address belongs to a Secretariat account.')
      // an account of another company is not moved by an access request: that is done on purpose, in People and accounts
      if (u.company_id && u.company_id !== c.id) {
        throw new HttpError(422, `That address already has an account with ${u.company ?? 'another company'}. If it should move to ${c.name}, change it in People and accounts.`)
      }
      // a disabled account comes back without its old password: the person sets a new one from the e-mailed link
      run(`UPDATE users SET company_id = ?, status = 'active', name = ?, position = ?, phone = ?, updated_at = ?${u.status !== 'active' ? ', password_hash = NULL' : ''} WHERE id = ?`,
        c.id, r.name, r.position, r.phone, now(), u.id)
      if (u.status !== 'active') endAllSessions(u.id)
      uid = u.id
    } else {
      uid = run(`INSERT INTO users (email, name, position, phone, role, company_id, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 'member', ?, 'active', ?, ?)`, r.email, r.name, r.position, r.phone, c.id, now(), now()).id
    }
    run(`UPDATE access_requests SET status = 'approved', company_id = ?, user_id = ?, decided_by = ?, decided_at = ? WHERE id = ?`,
      c.id, uid, me(req).id, now(), r.id)
    return uid
  })
  await sendWelcome(userId)
  audit(req, 'access approved', 'user', userId, `${r.name} · ${c.name}`)
  res.json({ ok: true, userId })
}))

admin.post('/access/:id/decline', wrap(async (req, res) => {
  const d = parse(z.object({ note: opt(1000), notify: z.boolean().default(false) }), req.body)
  const r = one('SELECT * FROM access_requests WHERE id = ?', id(req))
  if (!r || r.status !== 'pending') throw new HttpError(422, 'This request has already been answered.')
  run(`UPDATE access_requests SET status = 'declined', note = ?, decided_by = ?, decided_at = ? WHERE id = ?`, d.note, me(req).id, now(), r.id)
  if (d.notify) {
    await send({
      to: r.email,
      subject: 'Your request for access to the ELIA members’ area',
      text: `Dear ${r.name},\n\nThe ELIA Secretariat could not approve your request for access for ${r.company_name}.${d.note ? `\n\n${d.note}` : ''}\n\nFor questions, write to ${config.contactEmail}.`,
    })
  }
  audit(req, 'access declined', 'access_request', r.id, r.name)
  res.json({ ok: true })
}))

/* ---- profile changes ---- */

admin.get('/changes', wrap((req, res) => {
  const st = qs(req, 'status') || 'pending'
  res.json({
    items: all(`SELECT p.id, p.company_id, p.status, p.note, p.created_at, p.data, c.name AS company, u.name AS by_name
                FROM profile_changes p JOIN companies c ON c.id = p.company_id LEFT JOIN users u ON u.id = p.user_id
                ${st === 'all' ? '' : 'WHERE p.status = ?'} ORDER BY p.id DESC LIMIT 300`, ...(st === 'all' ? [] : [st]))
      .map((p) => ({ ...p, data: undefined, fields: Object.keys(fromJson(p.data, {})) })),
  })
}))

function describeFiles(v: unknown): unknown {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? fileRef(x) : x))
  return v
}

admin.get('/changes/:id', wrap((req, res) => {
  const p = one('SELECT * FROM profile_changes WHERE id = ?', id(req))
  if (!p) throw notFound()
  const c = one('SELECT * FROM companies WHERE id = ?', p.company_id)!
  const data = fromJson<Record<string, unknown>>(p.data, {})
  const rows = Object.entries(data).map(([k, v]) => {
    let before: unknown = c[k]
    if (k === 'certifications') before = fromJson(c[k], [])
    if (k === 'photos') before = describeFiles(fromJson(c[k], []))
    if (k === 'logo_file_id') return { field: 'logo', before: fileRef(c.logo_file_id), after: fileRef(v as number) }
    return { field: k, before, after: k === 'photos' ? describeFiles(v) : v }
  })
  res.json({ ...p, data: undefined, company: { id: c.id, name: c.name, slug: c.slug }, rows,
    by: one('SELECT name, email FROM users WHERE id = ?', p.user_id) ?? null })
}))

admin.post('/changes/:id/approve', wrap(async (req, res) => {
  const p = one('SELECT * FROM profile_changes WHERE id = ?', id(req))
  if (!p || p.status !== 'pending') throw new HttpError(422, 'This change has already been answered.')
  const data = fromJson<Record<string, unknown>>(p.data, {})
  const c = one('SELECT * FROM companies WHERE id = ?', p.company_id)!
  tx(() => {
    if (typeof data.name === 'string' && data.name !== c.name) data.slug = freeSlug(data.name, c.id)
    applyToCompany(c.id, data)
    run(`UPDATE profile_changes SET status = 'approved', decided_by = ?, decided_at = ? WHERE id = ?`, me(req).id, now(), p.id)
  })
  // the files the company no longer uses
  if ('logo_file_id' in data && c.logo_file_id && c.logo_file_id !== data.logo_file_id) removeFile(c.logo_file_id)
  if (Array.isArray(data.photos)) for (const old of fromJson<number[]>(c.photos, [])) if (!(data.photos as number[]).includes(old)) removeFile(old)
  const by = one('SELECT name, email FROM users WHERE id = ?', p.user_id)
  if (by) {
    await send({
      to: by.email,
      subject: 'Your company profile has been updated',
      text: `Dear ${by.name},\n\nThe ELIA Secretariat has approved the changes to ${c.name}’s profile. They now show in the members directory: ${link('/members/company/' + (data.slug ?? c.slug))}`,
    })
  }
  audit(req, 'profile change approved', 'company', c.id, Object.keys(data).join(', '))
  res.json({ ok: true })
}))

admin.post('/changes/:id/reject', wrap(async (req, res) => {
  const d = parse(z.object({ note: opt(1000) }), req.body)
  const p = one('SELECT * FROM profile_changes WHERE id = ?', id(req))
  if (!p || p.status !== 'pending') throw new HttpError(422, 'This change has already been answered.')
  run(`UPDATE profile_changes SET status = 'rejected', note = ?, decided_by = ?, decided_at = ? WHERE id = ?`, d.note, me(req).id, now(), p.id)
  const c = one('SELECT * FROM companies WHERE id = ?', p.company_id)!
  cleanWithdrawnFiles(p.data, [c.logo_file_id, ...fromJson<number[]>(c.photos, [])].filter(Boolean))
  const by = one('SELECT name, email FROM users WHERE id = ?', p.user_id)
  if (by) {
    await send({
      to: by.email,
      subject: 'About the changes to your company profile',
      text: `Dear ${by.name},\n\nThe ELIA Secretariat did not approve the latest changes to ${c.name}’s profile.${d.note ? `\n\n${d.note}` : ''}\n\nYou can make them again from your dashboard: ${link('/members/dashboard')}`,
    })
  }
  audit(req, 'profile change rejected', 'company', c.id)
  res.json({ ok: true })
}))

/* ---- member companies ---- */

admin.get('/companies', wrap((req, res) => {
  const where: string[] = []
  const p: unknown[] = []
  const q = qs(req, 'q'), st = qs(req, 'status'), cat = qs(req, 'category'), dues = qs(req, 'dues')
  if (q) { where.push(`(name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')`); p.push(like(q), like(q), like(q)) }
  if (st) { where.push('status = ?'); p.push(st) } else where.push(`status <> 'archived'`)
  if (cat) { where.push('category = ?'); p.push(cat) }
  if (dues === 'due') where.push(`(dues_paid_until IS NULL OR dues_paid_until < date('now'))`)
  res.json({
    items: all(`SELECT c.id, c.slug, c.name, c.category, c.size, c.city, c.region, c.status, c.listed, c.dues_paid_until, c.updated_at,
                       (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id AND u.status = 'active' AND u.role = 'member') AS users
                FROM companies c ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.name COLLATE NOCASE LIMIT 1000`, ...p),
  })
}))

admin.get('/companies/export.csv', wrap((_req, res) => {
  const rows = all(`SELECT * FROM companies WHERE status <> 'archived' ORDER BY name COLLATE NOCASE`).map((c) => ({
    ...c, certifications: fromJson<string[]>(c.certifications, []).join('; '), listed: c.listed ? 'yes' : 'no',
  }))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="elia-members-${now().slice(0, 10)}.csv"`)
  res.send(csv(rows, COMPANY_COLUMNS))
}))

/** "eliaet.com", "https://www.eliaet.com/" -> an http(s) address, or null for anything else (javascript:, data:, …) */
function webAddress(v: string): string | null {
  const t = v.trim()
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`)
    return (u.protocol === 'https:' || u.protocol === 'http:') && u.hostname.includes('.') ? u.toString().slice(0, 400) : null
  } catch { return null }
}

/** "Tannery", "tanneries", "Shoe manufacturer", "Leather products"... -> the category's key */
function categoryOf(v: string): string | null {
  const s = v.trim().toLowerCase()
  if (!s) return null
  if (Object.hasOwn(CATEGORIES, s)) return s
  if (/tann/.test(s)) return 'tannery'
  if (/shoe|foot/.test(s)) return 'footwear'
  if (/leather ?(goods|product)|garment|bag|glove|other leather/.test(s)) return 'leather_goods'
  if (/assoc|supplier|chemical|machin|service/.test(s)) return 'associate'
  return null
}

const COMPANY_COLUMNS: [string, string][] = [
  ['name', 'name'], ['category', 'category'], ['size', 'size'], ['year_established', 'year_established'], ['city', 'city'],
  ['region', 'region'], ['address', 'address'], ['products', 'products'], ['leather_types', 'leather_types'], ['capacity', 'capacity'],
  ['employees', 'employees'], ['export_status', 'export_status'], ['export_markets', 'export_markets'], ['certifications', 'certifications'],
  ['contact_name', 'contact_name'], ['contact_position', 'contact_position'], ['phone', 'phone'], ['email', 'email'], ['website', 'website'],
  ['member_since', 'member_since'], ['dues_paid_until', 'dues_paid_until'], ['status', 'status'], ['listed', 'listed'], ['slug', 'slug'],
]

/** what the import expects, as a ready-made spreadsheet */
admin.get('/companies/template.csv', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="elia-members-template.csv"')
  res.send(csv([{ name: 'Example Tannery PLC', category: 'tannery', size: 'large', city: 'Modjo', region: 'oromia', products: 'Finished sheep and goat leather', certifications: 'EHL; LWG', listed: 'yes' }], COMPANY_COLUMNS))
})

/** A spreadsheet of members (the export's columns, or a subset): new names are added, known ones updated. */
admin.post('/companies/import', upload.single('file'), wrap((req, res) => {
  if (!req.file) throw new HttpError(422, 'Choose a CSV file.', { file: 'Required' })
  const rows = parseCsv(req.file.buffer.toString('utf8'))
  if (!rows.length) throw new HttpError(422, 'The file has no rows under its header line.')
  const norm = (map: Record<string, string>, v: string) => {
    const k = v.trim().toLowerCase()
    if (!k) return null
    const hit = Object.entries(map).find(([key, label]) => key === k || label.toLowerCase() === k || key.replace(/_/g, ' ') === k)
    return hit ? hit[0] : undefined
  }
  const out = { added: 0, updated: 0, skipped: [] as string[] }
  tx(() => {
    rows.forEach((r, i) => {
      const line = i + 2
      const name = (r.name ?? r.company ?? r['company name'] ?? '').trim()
      if (!name) { out.skipped.push(`line ${line}: no name`); return }
      const category = categoryOf(r.category ?? r.sector ?? '')
      const fields: Record<string, unknown> = {}
      const set = (k: string, v: unknown) => { if (v !== undefined && v !== '') fields[k] = v }
      set('size', norm(SIZES as Record<string, string>, r.size ?? '') ?? undefined)
      set('region', norm(REGIONS as Record<string, string>, r.region ?? '') ?? undefined)
      set('export_status', norm(EXPORT_STATUS as Record<string, string>, r.export_status ?? r.export ?? '') ?? undefined)
      for (const k of ['city', 'address', 'products', 'leather_types', 'capacity', 'export_markets', 'contact_name', 'contact_position', 'phone', 'about', 'dues_note']) set(k, r[k])
      // a web address only if it is one (http or https); anything else is left out and reported
      if (r.website?.trim()) {
        const w = webAddress(r.website)
        if (w) set('website', w)
        else out.skipped.push(`line ${line}: ${name}: the website "${r.website.trim().slice(0, 60)}" is not a web address (left out)`)
      }
      if (r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) set('email', r.email.toLowerCase())
      for (const k of ['year_established', 'employees', 'member_since']) if (r[k] && /^\d+$/.test(r[k])) fields[k] = Number(r[k])
      if (r.dues_paid_until && /^\d{4}-\d{2}-\d{2}$/.test(r.dues_paid_until)) fields.dues_paid_until = r.dues_paid_until
      if (r.certifications) fields.certifications = r.certifications.split(/[;,]/).map((s) => s.trim().toUpperCase()).filter((s) => ['EHL', 'LWG', 'ISO'].includes(s))
      if (r.listed) fields.listed = /^(1|yes|true|y)$/i.test(r.listed) ? 1 : 0
      const found = one<{ id: number }>('SELECT id FROM companies WHERE name = ? COLLATE NOCASE OR (slug = ? AND ? <> \'\')', name, r.slug ?? '', r.slug ?? '')
      if (found) {
        if (category) fields.category = category
        applyToCompany(found.id, fields)
        out.updated++
      } else {
        if (!category) { out.skipped.push(`line ${line}: ${name}: category not recognised (tannery, footwear, leather goods, associate)`); return }
        createCompany({ name, category, ...fields } as never)
        out.added++
      }
    })
  })
  audit(req, 'members imported', 'company', null, `${out.added} added, ${out.updated} updated`)
  res.json(out)
}))

admin.post('/companies', wrap((req, res) => {
  const d = parse(adminSchema, req.body)
  if (d.slug && one('SELECT id FROM companies WHERE slug = ?', d.slug)) throw new HttpError(422, 'That address is taken.', { slug: 'Taken' })
  const cid = createCompany(d as never)
  audit(req, 'company created', 'company', cid, d.name)
  res.status(201).json({ ok: true, id: cid })
}))

admin.get('/companies/:id', wrap((req, res) => {
  const c = one('SELECT * FROM companies WHERE id = ?', id(req))
  if (!c) throw notFound()
  res.json({
    company: companyOut(c, true),
    users: all(`SELECT id, name, position, email, phone, status, last_login_at, password_hash IS NOT NULL AS has_password FROM users WHERE company_id = ? ORDER BY name`, c.id),
    requests: all(`SELECT id, name, email, status, created_at FROM access_requests WHERE company_id = ? ORDER BY id DESC LIMIT 20`, c.id),
    changes: all(`SELECT id, status, created_at FROM profile_changes WHERE company_id = ? ORDER BY id DESC LIMIT 20`, c.id),
  })
}))

admin.put('/companies/:id', wrap((req, res) => {
  const n = id(req)
  const c = one('SELECT * FROM companies WHERE id = ?', n)
  if (!c) throw notFound()
  const d = parse(adminSchema, req.body)
  const slug = d.slug || c.slug
  if (slug !== c.slug && one('SELECT id FROM companies WHERE slug = ?', slug)) throw new HttpError(422, 'That address is taken.', { slug: 'Taken' })
  applyToCompany(n, { ...d, slug, listed: d.listed ? 1 : 0 })
  if (d.status !== 'active' && c.status === 'active') {
    // a suspended or archived company's people keep their accounts, but nothing more is shown to them than their status
  }
  audit(req, 'company updated', 'company', n, d.name)
  res.json({ ok: true })
}))

admin.post('/companies/:id/files', upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'photos', maxCount: 4 }]), wrap((req, res) => {
  const n = id(req)
  const c = one('SELECT * FROM companies WHERE id = ?', n)
  if (!c) throw notFound()
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>
  const changes: Record<string, unknown> = {}
  if (files.logo?.[0]) {
    changes.logo_file_id = store(files.logo[0], 'image', 'members', me(req).id, 'logo')
    if (c.logo_file_id) removeFile(c.logo_file_id)
  } else if (req.body.removeLogo === 'true' && c.logo_file_id) {
    changes.logo_file_id = null
    removeFile(c.logo_file_id)
  }
  const current = fromJson<number[]>(c.photos, [])
  const keep = String(req.body.keepPhotos ?? current.join(',')).split(',').map(Number).filter((x) => current.includes(x))
  for (const old of current) if (!keep.includes(old)) removeFile(old)
  const photos = [...keep, ...(files.photos ?? []).map((f) => store(f, 'image', 'members', me(req).id, 'photos'))].slice(0, 4)
  changes.photos = photos
  applyToCompany(n, changes)
  audit(req, 'company pictures', 'company', n)
  res.json({ ok: true, company: companyOut(one('SELECT * FROM companies WHERE id = ?', n)!, true) })
}))

/* ---- people ---- */

admin.get('/users', wrap((req, res) => {
  const q = qs(req, 'q'), role = qs(req, 'role')
  const where: string[] = []
  const p: unknown[] = []
  if (q) { where.push(`(u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')`); p.push(like(q), like(q), like(q)) }
  if (role) { where.push('u.role = ?'); p.push(role) }
  res.json({
    items: all(`SELECT u.id, u.name, u.email, u.position, u.phone, u.role, u.status, u.company_id, c.name AS company, u.last_login_at,
                       u.password_hash IS NOT NULL AS has_password, u.created_at
                FROM users u LEFT JOIN companies c ON c.id = u.company_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                ORDER BY u.role DESC, u.name COLLATE NOCASE LIMIT 1000`, ...p),
  })
}))

const userSchema = z.object({
  name: required(120), email, position: opt(120), phone: opt(40),
  role: z.enum(['member', 'secretariat']),
  company_id: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().positive().nullable()),
})

admin.post('/users', wrap(async (req, res) => {
  const d = parse(userSchema, req.body)
  if (one('SELECT id FROM users WHERE email = ?', d.email)) throw new HttpError(422, 'That address already has an account.', { email: 'Taken' })
  if (d.role === 'member') {
    if (!d.company_id) throw new HttpError(422, 'Choose the member company.', { company_id: 'Required' })
    const count = Number(one(`SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND role = 'member' AND status = 'active'`, d.company_id)?.n ?? 0)
    if (count >= config.usersPerCompany) throw new HttpError(422, `That company already has ${count} people signed up (the limit is ${config.usersPerCompany}).`)
  }
  const uid = run(`INSERT INTO users (email, name, position, phone, role, company_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    d.email, d.name, d.position, d.phone, d.role, d.role === 'member' ? d.company_id : null, now(), now()).id
  await sendWelcome(uid)
  audit(req, 'user created', 'user', uid, `${d.name} (${d.role})`)
  res.status(201).json({ ok: true, id: uid })
}))

admin.put('/users/:id', wrap((req, res) => {
  const n = id(req)
  const d = parse(userSchema.extend({ status: z.enum(['active', 'disabled']) }), req.body)
  const u = one('SELECT * FROM users WHERE id = ?', n)
  if (!u) throw notFound()
  if (n === me(req).id && (d.status !== 'active' || d.role !== 'secretariat')) throw new HttpError(422, 'You cannot take away your own access.')
  if (d.email !== u.email && one('SELECT id FROM users WHERE email = ? AND id <> ?', d.email, n)) throw new HttpError(422, 'That address already has an account.', { email: 'Taken' })
  run(`UPDATE users SET name = ?, email = ?, position = ?, phone = ?, role = ?, company_id = ?, status = ?, updated_at = ? WHERE id = ?`,
    d.name, d.email, d.position, d.phone, d.role, d.role === 'member' ? d.company_id : null, d.status, now(), n)
  if (d.status !== 'active' || d.role !== u.role || d.email !== u.email) endAllSessions(n)
  audit(req, 'user updated', 'user', n, `${d.name} · ${d.status}`)
  res.json({ ok: true })
}))

admin.post('/users/:id/link', wrap(async (req, res) => {
  const n = id(req)
  const u = one('SELECT id, status FROM users WHERE id = ?', n)
  if (!u || u.status !== 'active') throw new HttpError(422, 'That account is not active.')
  await sendWelcome(n)
  audit(req, 'password link sent', 'user', n)
  res.json({ ok: true })
}))

/* ---- what ELIA publishes: one pattern for news, events, publications, notices and opportunities ---- */

type FileSpec = { field: string; column: string; kind: Kind; access: (row: Record<string, unknown>) => Access }
interface Collection {
  table: string
  schema: z.ZodObject<any>
  order: string
  slug?: boolean
  dateColumn?: string
  file?: FileSpec
  label: string
}

const COLLECTIONS: Record<string, Collection> = {
  posts: {
    table: 'posts', label: 'post', slug: true, order: 'date DESC, id DESC',
    schema: z.object({
      title: required(200), slug: z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(90).regex(/^[a-z0-9-]*$/, 'Lower-case letters, digits and dashes')),
      date: z.string().trim().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'YYYY-MM-DD'), category: z.enum(keys(POST_CATEGORIES)),
      summary: opt(600), body: opt(40000), image_url: opt(300), link_url: url, featured: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()),
      status: z.enum(['draft', 'published']),
    }),
    file: { field: 'image', column: 'image_file_id', kind: 'image', access: () => 'public' },
  },
  events: {
    table: 'events', label: 'event', slug: true, order: "COALESCE(starts_on, '9999') DESC, id DESC",
    schema: z.object({
      title: required(200), slug: z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(90).regex(/^[a-z0-9-]*$/, 'Lower-case letters, digits and dashes')),
      starts_on: day, ends_on: day, time_text: opt(80), venue: opt(160), address: opt(240), map_url: url,
      summary: opt(600), body: opt(20000), register_url: url, image_url: opt(300), status: z.enum(['draft', 'published']),
    }),
  },
  publications: {
    table: 'publications', label: 'publication', order: 'COALESCE(year, 0) DESC, id DESC',
    schema: z.object({
      title: required(200), key: z.preprocess((v) => (v == null ? '' : v), z.string().trim().toLowerCase().max(60).regex(/^[a-z0-9-]*$/, 'Lower-case letters, digits and dashes')),
      type: z.enum(PUBLICATION_TYPES), year: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().min(1990).max(2100).nullable()),
      access: z.enum(['public', 'members']), summary: opt(1000), link_url: url, status: z.enum(['draft', 'published']),
    }),
    file: { field: 'file', column: 'file_id', kind: 'doc', access: (r) => (r.access === 'members' ? 'members' : 'public') },
  },
  notices: {
    table: 'notices', label: 'notice', order: 'published_on DESC, id DESC', dateColumn: 'published_on',
    schema: z.object({ title: required(200), kind: z.enum(keys(NOTICE_KINDS)), body: opt(20000), published_on: z.iso.date('Pick a date') }),
    file: { field: 'file', column: 'file_id', kind: 'doc', access: () => 'members' },
  },
  opportunities: {
    table: 'opportunities', label: 'opportunity', order: 'published_on DESC, id DESC', dateColumn: 'published_on',
    schema: z.object({
      title: required(200), kind: z.enum(keys(OPPORTUNITY_KINDS)), body: opt(20000), deadline: day, link_url: url, published_on: z.iso.date('Pick a date'),
    }),
    file: { field: 'file', column: 'file_id', kind: 'doc', access: () => 'members' },
  },
}

function uniqueSlug(table: string, want: string, title: string, except?: number) {
  const base = want || slugify(title)
  for (let i = 1; ; i++) {
    const s = i === 1 ? base : `${base}-${i}`
    const hit = one<{ id: number }>(`SELECT id FROM ${table} WHERE slug = ?`, s)
    if (!hit || hit.id === except) return s
  }
}

function withFile(c: Collection, r: Row) {
  return c.file ? { ...r, file: fileRef(r[c.file.column] as number) } : r
}

for (const [name, c] of Object.entries(COLLECTIONS)) {
  const fields = Object.keys(c.schema.shape)

  admin.get(`/${name}`, wrap((_req, res) => {
    res.json({ items: all(`SELECT * FROM ${c.table} ORDER BY ${c.order} LIMIT 500`).map((r) => withFile(c, r)) })
  }))

  admin.get(`/${name}/:id`, wrap((req, res) => {
    const r = one(`SELECT * FROM ${c.table} WHERE id = ?`, id(req))
    if (!r) throw notFound()
    res.json(withFile(c, r))
  }))

  const save = (req: Request, existing: Row | null) => {
    const d = parse(c.schema, req.body) as Record<string, unknown>
    if (c.slug) d.slug = uniqueSlug(c.table, String(d.slug ?? ''), String(d.title), existing?.id)
    if ('key' in d) {
      // a publication's short address (/downloads/<key>): optional, and only one publication can have it
      d.key = d.key || null
      const taken = d.key ? one<{ id: number }>(`SELECT id FROM ${c.table} WHERE key = ?`, d.key) : null
      if (taken && taken.id !== existing?.id) throw new HttpError(422, 'Please check the highlighted fields.', { key: 'Another publication has this address' })
    }
    const row: Record<string, unknown> = { ...d }
    for (const k of Object.keys(row)) if (typeof row[k] === 'boolean') row[k] = row[k] ? 1 : 0
    const f = c.file
    const up = (req.files as Record<string, Express.Multer.File[]> | undefined)?.[f?.field ?? '']?.[0]
    if (f) {
      if (up) {
        row[f.column] = store(up, f.kind, f.access(row), me(req).id, f.field)
        if (existing?.[f.column]) removeFile(existing[f.column] as number)
      } else if (req.body[`remove_${f.field}`] === 'true' && existing?.[f.column]) {
        removeFile(existing[f.column] as number)
        row[f.column] = null
      } else if (existing?.[f.column]) {
        setAccess(existing[f.column] as number, f.access(row))       // a publication moved between public and members-only
      }
    }
    return row
  }

  const parts = c.file ? upload.fields([{ name: c.file.field, maxCount: 1 }]) : upload.none()

  admin.post(`/${name}`, parts, wrap((req, res) => {
    const row = save(req, null)
    const cols = Object.keys(row)
    const t = now()
    const extra = c.table === 'notices' || c.table === 'opportunities' || c.table === 'posts' ? ['created_by'] : []
    const nid = run(`INSERT INTO ${c.table} (${[...cols, ...extra, 'created_at', 'updated_at'].join(', ')})
                     VALUES (${[...cols, ...extra, 'c', 'u'].map(() => '?').join(', ')})`,
      ...cols.map((k) => row[k]), ...extra.map(() => me(req).id), t, t).id
    audit(req, `${c.label} created`, c.table, nid, String(row.title))
    res.status(201).json({ ok: true, id: nid })
  }))

  admin.put(`/${name}/:id`, parts, wrap((req, res) => {
    const n = id(req)
    const existing = one(`SELECT * FROM ${c.table} WHERE id = ?`, n)
    if (!existing) throw notFound()
    const row = save(req, existing)
    const cols = Object.keys(row).filter((k) => fields.includes(k) || k === c.file?.column || k === 'slug')
    run(`UPDATE ${c.table} SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...cols.map((k) => row[k]), now(), n)
    audit(req, `${c.label} updated`, c.table, n, String(row.title))
    res.json({ ok: true })
  }))

  admin.delete(`/${name}/:id`, wrap((req, res) => {
    const n = id(req)
    const existing = one(`SELECT * FROM ${c.table} WHERE id = ?`, n)
    if (!existing) throw notFound()
    run(`DELETE FROM ${c.table} WHERE id = ?`, n)
    if (c.file && existing[c.file.column]) removeFile(existing[c.file.column] as number)
    audit(req, `${c.label} deleted`, c.table, n, String(existing.title))
    res.json({ ok: true })
  }))
}

/* ---- the forms' inbox ---- */

admin.get('/inquiries', wrap((req, res) => {
  const where: string[] = []
  const p: unknown[] = []
  const kind = qs(req, 'kind'), st = qs(req, 'status'), q = qs(req, 'q')
  if (kind) { where.push('kind = ?'); p.push(kind) }
  if (st) { where.push('status = ?'); p.push(st) } else where.push(`status <> 'spam'`)
  if (q) { where.push(`(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR organization LIKE ? ESCAPE '\\' OR subject LIKE ? ESCAPE '\\' OR ref LIKE ? ESCAPE '\\')`); p.push(like(q), like(q), like(q), like(q), like(q)) }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const total = Number(one(`SELECT COUNT(*) AS n FROM inquiries ${w}`, ...p)?.n ?? 0)
  const pg = page(req)
  res.json({
    total, page: pg, pages: Math.max(1, Math.ceil(total / 50)),
    items: all(`SELECT id, ref, kind, team, name, email, organization, subject, status, created_at FROM inquiries ${w} ORDER BY id DESC LIMIT 50 OFFSET ?`, ...p, (pg - 1) * 50),
  })
}))

admin.get('/inquiries/export.csv', wrap((req, res) => {
  const kind = qs(req, 'kind')
  const rows = all(`SELECT * FROM inquiries ${kind ? 'WHERE kind = ?' : ''} ORDER BY id DESC`, ...(kind ? [kind] : []))
  const flat = rows.map((r) => ({ ...r, ...fromJson<Record<string, unknown>>(r.data, {}) }))
  const extra = [...new Set(flat.flatMap((r) => Object.keys(fromJson(rows.find((x) => x.id === r.id)?.data, {}))))]
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="elia-inquiries-${kind || 'all'}-${now().slice(0, 10)}.csv"`)
  res.send(csv(flat, [['ref', 'Reference'], ['created_at', 'Received'], ['kind', 'Form'], ['team', 'Team'], ['status', 'Status'],
    ...extra.map((k) => [k, k] as [string, string]), ['note', 'Note']]))
}))

admin.get('/inquiries/:id', wrap((req, res) => {
  const r = one('SELECT * FROM inquiries WHERE id = ?', id(req))
  if (!r) throw notFound()
  res.json({ ...r, data: fromJson(r.data, {}), handler: r.handled_by ? one('SELECT name FROM users WHERE id = ?', r.handled_by)?.name : null })
}))

admin.put('/inquiries/:id', wrap((req, res) => {
  const d = parse(z.object({ status: z.enum(['new', 'open', 'done', 'spam']), note: opt(4000) }), req.body)
  const n = id(req)
  run('UPDATE inquiries SET status = ?, note = ?, handled_by = ?, handled_at = ? WHERE id = ?', d.status, d.note, me(req).id, now(), n)
  audit(req, `inquiry ${d.status}`, 'inquiry', n)
  res.json({ ok: true })
}))

/* ---- newsletter subscribers ---- */

admin.get('/subscribers', wrap((req, res) => {
  const q = qs(req, 'q')
  res.json({
    items: all(`SELECT id, email, interests, created_at, unsubscribed_at FROM subscribers ${q ? `WHERE email LIKE ? ESCAPE '\\'` : ''}
                ORDER BY id DESC LIMIT 2000`, ...(q ? [like(q)] : [])).map((s) => ({ ...s, interests: fromJson<string[]>(s.interests, []) })),
  })
}))

admin.get('/subscribers/export.csv', wrap((_req, res) => {
  const rows = all(`SELECT email, interests, created_at FROM subscribers WHERE unsubscribed_at IS NULL ORDER BY id`)
    .map((s) => ({ ...s, interests: fromJson<string[]>(s.interests, []) }))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="elia-subscribers-${now().slice(0, 10)}.csv"`)
  res.send(csv(rows, [['email', 'E-mail'], ['interests', 'Interests'], ['created_at', 'Subscribed']]))
}))

admin.delete('/subscribers/:id', wrap((req, res) => {
  const n = id(req)
  run('DELETE FROM subscribers WHERE id = ?', n)
  audit(req, 'subscriber removed', 'subscriber', n)
  res.json({ ok: true })
}))

/* small things the back office pages need */
admin.get('/companies-list', wrap((_req, res) => {
  res.json({ items: all(`SELECT id, name, status FROM companies WHERE status <> 'archived' ORDER BY name COLLATE NOCASE`) })
}))

