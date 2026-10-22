/* Member companies: how a company row becomes what the pages show, the fields a member may change (the Secretariat
   reviews every change before it shows), and the directory's search. */
import { z } from 'zod'
import { one, all, run, now, fromJson, toJson, type Row } from './db.js'
import { fileRef, fileUrl } from './files.js'
import { str, opt, intOrNull, url, optEmail, slugify } from './util.js'
import { CATEGORIES, SIZES, REGIONS, EXPORT_STATUS, CERTIFICATIONS, REGION_FILTERS } from '../../shared/options.js'

const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]

/** The profile a member can edit (category and size are as registered with ELIA: the Secretariat's to change). */
export const profileSchema = z.object({
  name: str(200).min(2, 'Required'),
  year_established: intOrNull(1900, new Date().getFullYear()),
  city: opt(80),
  region: z.preprocess((v) => (v === '' ? null : v), z.enum(keys(REGIONS)).nullable()),
  address: opt(240),
  lat: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().min(3).max(15).nullable()),
  lng: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().min(32).max(48.5).nullable()),
  products: opt(600),
  leather_types: opt(300),
  capacity: opt(160),
  employees: intOrNull(0, 1_000_000),
  export_status: z.preprocess((v) => (v === '' ? null : v), z.enum(keys(EXPORT_STATUS)).nullable()),
  export_markets: opt(400),
  certifications: z.preprocess((v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : String(v).split(',')),
    z.array(z.enum(keys(CERTIFICATIONS))).max(3)),
  contact_name: opt(120),
  contact_position: opt(120),
  phone: opt(80),
  email: optEmail,
  website: url,
  about: opt(2000),
})
export type Profile = z.infer<typeof profileSchema>
export const PROFILE_FIELDS = Object.keys(profileSchema.shape) as (keyof Profile)[]

/** Everything the Secretariat sets on top of the profile. */
export const adminSchema = profileSchema.extend({
  slug: z.preprocess((v) => (v == null ? '' : v), z.string().trim().max(80).regex(/^[a-z0-9-]*$/, 'Lower-case letters, digits and dashes')),
  category: z.enum(keys(CATEGORIES), { error: 'Choose one' }),
  size: z.preprocess((v) => (v === '' ? null : v), z.enum(keys(SIZES)).nullable()),
  status: z.enum(['active', 'suspended', 'archived']),
  listed: z.preprocess((v) => v === true || v === 'true' || v === '1' || v === 1, z.boolean()),
  member_since: intOrNull(1994, new Date().getFullYear()),
  dues_paid_until: z.preprocess((v) => (v === '' || v == null ? null : v), z.iso.date('Pick a date').nullable()),
  dues_note: opt(300),
})
export type AdminCompany = z.infer<typeof adminSchema>

/** What the pages get for a company. `full` adds what only its own people and the Secretariat see. */
export function companyOut(c: Row, full = false) {
  const photos = fromJson<number[]>(c.photos, []).map((id) => fileRef(id)).filter(Boolean)
  const out: Record<string, unknown> = {
    id: c.id, slug: c.slug, name: c.name,
    category: c.category, categoryLabel: CATEGORIES[c.category as keyof typeof CATEGORIES] ?? c.category,
    size: c.size, sizeLabel: c.size ? SIZES[c.size as keyof typeof SIZES] : null,
    year_established: c.year_established, city: c.city, region: c.region,
    regionLabel: c.region ? REGIONS[c.region as keyof typeof REGIONS] ?? c.region : null,
    address: c.address, lat: c.lat, lng: c.lng,
    products: c.products, leather_types: c.leather_types, capacity: c.capacity, employees: c.employees,
    export_status: c.export_status, exportLabel: c.export_status ? EXPORT_STATUS[c.export_status as keyof typeof EXPORT_STATUS] : null,
    export_markets: c.export_markets, certifications: fromJson<string[]>(c.certifications, []),
    contact_name: c.contact_name, contact_position: c.contact_position, phone: c.phone, email: c.email, website: c.website,
    about: c.about, logo: fileUrl(c.logo_file_id), logo_file_id: c.logo_file_id, photos,
    updated_at: c.updated_at, member_since: c.member_since,
  }
  if (full) {
    Object.assign(out, {
      status: c.status, listed: !!c.listed, dues_paid_until: c.dues_paid_until, dues_note: c.dues_note, created_at: c.created_at,
    })
  }
  return out
}

/** A card in the directory list: a few fields. */
export function cardOut(c: Row) {
  return {
    slug: c.slug, name: c.name, category: c.category, categoryLabel: CATEGORIES[c.category as keyof typeof CATEGORIES] ?? c.category,
    size: c.size, city: c.city, regionLabel: c.region ? REGIONS[c.region as keyof typeof REGIONS] ?? c.region : null,
    products: c.products, export_status: c.export_status, certifications: fromJson<string[]>(c.certifications, []),
    logo: fileUrl(c.logo_file_id),
  }
}

export interface DirectoryQuery {
  q?: string; category?: string; size?: string; region?: string; export?: string; cert?: string; page?: number; per?: number
  sort?: 'name' | 'updated'; includeHidden?: boolean
}

/** The directory: search and filters, A to Z, 20 to a page. */
export function directory(o: DirectoryQuery) {
  const where: string[] = [o.includeHidden ? "status <> 'archived'" : "status = 'active' AND listed = 1"]
  const p: unknown[] = []
  const q = (o.q ?? '').trim().slice(0, 80)
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%'
    where.push(`(name LIKE ? ESCAPE '\\' OR products LIKE ? ESCAPE '\\' OR leather_types LIKE ? ESCAPE '\\' OR about LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR export_markets LIKE ? ESCAPE '\\')`)
    p.push(like, like, like, like, like, like)
  }
  if (o.category && Object.hasOwn(CATEGORIES, o.category)) { where.push('category = ?'); p.push(o.category) }
  if (o.size && Object.hasOwn(SIZES, o.size)) { where.push('size = ?'); p.push(o.size) }
  if (o.region && Object.hasOwn(REGION_FILTERS, o.region)) {
    if (o.region === 'other') where.push("(region IS NULL OR region NOT IN ('addis_ababa', 'oromia', 'amhara'))")
    else { where.push('region = ?'); p.push(o.region) }
  }
  if (o.export && Object.hasOwn(EXPORT_STATUS, o.export)) { where.push('export_status = ?'); p.push(o.export) }
  if (o.cert && Object.hasOwn(CERTIFICATIONS, o.cert)) { where.push('certifications LIKE ?'); p.push(`%"${o.cert}"%`) }
  const w = where.join(' AND ')
  const total = Number(one(`SELECT COUNT(*) AS n FROM companies WHERE ${w}`, ...p)?.n ?? 0)
  const per = Math.min(Math.max(o.per ?? 20, 1), 100)
  const pages = Math.max(1, Math.ceil(total / per))
  const page = Math.min(Math.max(1, o.page ?? 1), pages)
  const order = o.sort === 'updated' ? 'updated_at DESC' : 'name COLLATE NOCASE ASC'
  const rows = all(`SELECT * FROM companies WHERE ${w} ORDER BY ${order} LIMIT ? OFFSET ?`, ...p, per, (page - 1) * per)
  return { items: rows.map(cardOut), total, page, pages, per }
}

/** The fields of `next` that differ from the company now (for a member's proposed change). */
export function diff(current: Row, next: Partial<Profile> & { logo_file_id?: number | null; photos?: number[] }) {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(next)) {
    let cur: unknown = current[k]
    if (k === 'certifications' || k === 'photos') cur = fromJson(current[k], [])
    const a = JSON.stringify(cur ?? (Array.isArray(v) ? [] : null)), b = JSON.stringify(v ?? (Array.isArray(cur) ? [] : null))
    const blank = (x: unknown) => x === null || x === '' || x === undefined
    if (a !== b && !(blank(cur) && blank(v))) out[k] = v
  }
  return out
}

/** Writes fields onto a company (a change the Secretariat approved, or its own edit). */
export function applyToCompany(id: number, fields: Record<string, unknown>) {
  const cols = Object.keys(fields).filter((k) => /^[a-z_]+$/.test(k))
  if (!cols.length) return
  const vals = cols.map((k) => (k === 'certifications' || k === 'photos' ? toJson(fields[k]) : typeof fields[k] === 'boolean' ? (fields[k] ? 1 : 0) : fields[k]))
  run(`UPDATE companies SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, ...vals, now(), id)
}

/** A slug not yet taken: "kinaff-leather", then "kinaff-leather-2"… */
export function freeSlug(name: string, except?: number): string {
  const base = slugify(name)
  for (let i = 1; ; i++) {
    const s = i === 1 ? base : `${base}-${i}`
    const hit = one<{ id: number }>('SELECT id FROM companies WHERE slug = ?', s)
    if (!hit || hit.id === except) return s
  }
}

export function createCompany(f: Partial<AdminCompany> & { name: string; category: string }): number {
  const slug = f.slug || freeSlug(f.name)
  const t = now()
  const id = run(`INSERT INTO companies (slug, name, category, status, listed, certifications, photos, created_at, updated_at)
                  VALUES (?, ?, ?, 'active', 1, '[]', '[]', ?, ?)`, slug, f.name, f.category, t, t).id
  const { slug: _s, name: _n, category: _c, ...rest } = f
  applyToCompany(id, rest)
  return id
}
