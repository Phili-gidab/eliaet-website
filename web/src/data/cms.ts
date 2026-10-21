/* Build-time content: the posts, events and publications the database starts with (server/data/seed), as HTML made
   by the same functions the server uses on every visit (shared/render.ts). So a built page already shows what the
   live one will, before the server puts the current content in its place (server/src/pages.ts). */
import fs from 'node:fs'
import path from 'node:path'
import { POST_CATEGORIES } from '../../../shared/options'
import { postCard, eventRow, pubRow, type CardPost, type CardEvent, type CardPublication } from '../../../shared/render'
import { srcsetFor } from '../lib/media'

const SEED = [path.resolve(process.cwd(), '../server/data/seed'), path.resolve(process.cwd(), 'server/data/seed')].find((d) => fs.existsSync(d)) ?? ''

function read<T>(file: string, key: string): T[] {
  try {
    return (JSON.parse(fs.readFileSync(path.join(SEED, file), 'utf8'))[key] ?? []) as T[]
  } catch {
    return []
  }
}

/** Addis Ababa's calendar day (UTC+3), as the server counts it */
export const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)

type SeedPost = { slug: string; title: string; date?: string; category: string; summary?: string; image_url?: string; link_url?: string; featured?: boolean; status?: string }
type SeedEvent = { slug: string; title: string; starts_on?: string; ends_on?: string; time_text?: string; venue?: string; summary?: string; status?: string }
type SeedPub = { key?: string; title: string; type: string; year?: number; access?: 'public' | 'members'; summary?: string; file?: string; link_url?: string; status?: string }

export function posts(o: { category?: string; featured?: boolean; limit?: number } = {}): CardPost[] {
  return read<SeedPost>('posts.json', 'posts')
    .filter((p) => (p.status ?? 'published') === 'published' && (!o.category || p.category === o.category) && (!o.featured || p.featured))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, o.limit ?? 9)
    .map((p) => ({
      slug: p.slug, title: p.title, date: p.date ?? null, summary: p.summary ?? '', image: p.image_url ?? null,
      category: POST_CATEGORIES[p.category as keyof typeof POST_CATEGORIES] ?? p.category,
      href: p.link_url || `/news/${p.slug}`, external: !!p.link_url && /^https?:/i.test(p.link_url),
    }))
}

export function postCount(category?: string): number {
  return read<SeedPost>('posts.json', 'posts').filter((p) => (p.status ?? 'published') === 'published' && (!category || p.category === category)).length
}

/** upcoming (and undated) events, soonest first */
export function events(): CardEvent[] {
  const t = today()
  return read<SeedEvent>('events.json', 'events')
    .filter((e) => (e.status ?? 'published') === 'published' && (!e.starts_on || (e.ends_on ?? e.starts_on) >= t))
    .sort((a, b) => (a.starts_on ? 0 : 1) - (b.starts_on ? 0 : 1) || (a.starts_on ?? '').localeCompare(b.starts_on ?? ''))
    .map((e) => ({ ...e, starts_on: e.starts_on ?? null, ends_on: e.ends_on ?? null, time_text: e.time_text ?? null, venue: e.venue ?? null, href: `/events/${e.slug}` }))
}

/** the library; a document's file is reached through its short address (/downloads/profile), which the server
    resolves to the current file */
export function publications(): CardPublication[] {
  return read<SeedPub>('publications.json', 'publications')
    .filter((p) => (p.status ?? 'published') === 'published')
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .map((p, i) => {
      const file = p.file ? path.join(SEED, 'files', p.file) : ''
      const size = file && fs.existsSync(file) ? fs.statSync(file).size : null
      return {
        id: i + 1, title: p.title, type: p.type, year: p.year ?? null, access: p.access ?? 'public', summary: p.summary ?? '',
        url: size && p.key ? `/downloads/${p.key}` : p.link_url ?? null, size,
      }
    })
}

export const html = {
  posts: (list: CardPost[]) => list.map((p, i) => postCard(p, i, srcsetFor)).join(''),
  events: (list: CardEvent[]) => list.map(eventRow).join(''),
  pubs: (list: CardPublication[]) => list.map(pubRow).join(''),
}
