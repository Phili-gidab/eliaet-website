/* What the public pages show from the database: published posts, events and publications, in the shapes the shared
   renderers take (shared/render.ts). */
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { all, one, type Row } from './db.js'
import { fileRef, fileUrl } from './files.js'
import type { CardPost, CardEvent, CardPublication } from '../../shared/render.js'
import { POST_CATEGORIES } from '../../shared/options.js'

export const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)   // Addis Ababa's day

export function postOut(p: Row): CardPost & { id: number; categoryKey: string; body: string; featured: boolean; link_url: string | null } {
  const image = fileUrl(p.image_file_id) ?? p.image_url ?? null
  return {
    id: p.id, slug: p.slug, title: p.title, categoryKey: p.category,
    category: POST_CATEGORIES[p.category as keyof typeof POST_CATEGORIES] ?? p.category,
    date: p.date, summary: p.summary, image, body: p.body, featured: !!p.featured, link_url: p.link_url ?? null,
    href: p.link_url || `/news/${p.slug}`, external: !!p.link_url && /^https?:/i.test(p.link_url),
  }
}

export function posts(o: { category?: string; limit?: number; offset?: number; featured?: boolean } = {}) {
  const where = [`status = 'published'`]
  const p: unknown[] = []
  if (o.category) { where.push('category = ?'); p.push(o.category) }
  if (o.featured) where.push('featured = 1')
  const w = where.join(' AND ')
  const total = Number(one(`SELECT COUNT(*) AS n FROM posts WHERE ${w}`, ...p)?.n ?? 0)
  const rows = all(`SELECT * FROM posts WHERE ${w} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`, ...p, o.limit ?? 9, o.offset ?? 0)
  return { total, items: rows.map(postOut) }
}

export function eventOut(e: Row): CardEvent & Row {
  return { ...e, href: `/events/${e.slug}` } as CardEvent & Row
}

/** Upcoming (and undated) events first, soonest first; then, if asked, the past ones. */
export function events(o: { past?: boolean; limit?: number } = {}) {
  const t = today()
  const rows = o.past
    ? all(`SELECT * FROM events WHERE status = 'published' AND starts_on IS NOT NULL AND COALESCE(ends_on, starts_on) < ? ORDER BY starts_on DESC LIMIT ?`, t, o.limit ?? 12)
    : all(`SELECT * FROM events WHERE status = 'published' AND (starts_on IS NULL OR COALESCE(ends_on, starts_on) >= ?)
           ORDER BY starts_on IS NULL, starts_on ASC LIMIT ?`, t, o.limit ?? 24)
  return rows.map(eventOut)
}

export function publications(): CardPublication[] {
  return all(`SELECT * FROM publications WHERE status = 'published' ORDER BY COALESCE(year, 0) DESC, id DESC`).map((p) => {
    const f = fileRef(p.file_id)
    return { id: p.id, title: p.title, type: p.type, year: p.year, access: p.access, summary: p.summary, url: f?.url ?? p.link_url ?? null, size: f?.size ?? null }
  })
}

/** srcset for a picture shipped with the site (as web/src/lib/media.ts does at build time) */
const WIDTHS = [480, 720, 960, 1280]
const ssCache = new Map<string, string | undefined>()
function webpWidth(file: string): number | undefined {
  try {
    const fd = fs.openSync(file, 'r')
    const b = Buffer.alloc(30)
    fs.readSync(fd, b, 0, 30, 0)
    fs.closeSync(fd)
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return undefined
    const chunk = b.toString('ascii', 12, 16)
    if (chunk === 'VP8 ') return b.readUInt16LE(26) & 0x3fff
    if (chunk === 'VP8L') return (b.readUInt32LE(21) & 0x3fff) + 1
    if (chunk === 'VP8X') return b.readUIntLE(24, 3) + 1
  } catch { /* no such file */ }
  return undefined
}
export function srcset(src: string): string | undefined {
  if (!src.startsWith('/media/') || !src.endsWith('.webp')) return undefined
  if (ssCache.has(src)) return ssCache.get(src)
  const full = webpWidth(path.join(config.clientDist, src))
  const stem = src.slice(0, -5)
  const parts = full ? WIDTHS.filter((w) => w < full && fs.existsSync(path.join(config.clientDist, `${stem}-${w}.webp`))).map((w) => `${stem}-${w}.webp ${w}w`) : []
  const out = parts.length ? [...parts, `${src} ${full}w`].join(', ') : undefined
  ssCache.set(src, out)
  return out
}
