/* What a new database starts with: the member companies the current site lists (server/data/members.json, with their
   logos), and the content document's starter posts, events and publications (server/data/seed/). Runs once, the
   first time the server starts with an empty database; after that everything is managed in the back office. */
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { one, run, now, tx, toJson } from './db.js'
import { storeLocal } from './files.js'
import { freeSlug } from './companies.js'

const read = <T>(file: string): T | null => {
  try { return JSON.parse(fs.readFileSync(path.join(config.seedDir, file), 'utf8')) as T } catch { return null }
}

type Member = { slug: string; name: string; public?: boolean; sectors: string[]; city?: string; ehlCertified?: boolean; logo?: string;
  phones?: { label: string; value: string }[]; emails?: string[]; website?: string }

const REGION_OF_CITY: Record<string, string> = { 'addis ababa': 'addis_ababa', 'bahir dar': 'amhara', modjo: 'oromia', mojo: 'oromia' }

export function seedIfEmpty() {
  if (one(`SELECT value FROM meta WHERE key = 'seeded'`)) return
  tx(() => {
    const members = read<{ members: Member[] }>('members.json')?.members ?? []
    for (const m of members) {
      const category = m.sectors.includes('tannery') ? 'tannery' : m.sectors.includes('footwear') ? 'footwear' : 'leather_goods'
      let logo: number | null = null
      const logoFile = m.logo ? path.join(config.clientDist, m.logo) : ''
      if (logoFile && fs.existsSync(logoFile)) {
        try { logo = storeLocal(logoFile, 'members') } catch { logo = null }
      }
      const t = now()
      run(`INSERT INTO companies (slug, name, category, city, region, certifications, phone, email, website, logo_file_id, status, listed, public_listing, photos, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, '[]', ?, ?)`,
        freeSlug(m.slug || m.name), m.name, category, m.city ?? null, m.city ? REGION_OF_CITY[m.city.toLowerCase()] ?? null : null,
        toJson(m.ehlCertified ? ['EHL'] : []), m.phones?.map((p) => `${p.label} ${p.value}`).join(' · ') ?? null,
        m.emails?.[0] ?? null, m.website ? (m.website.startsWith('http') ? m.website : `https://${m.website}`) : null, logo, m.public ? 1 : 0, t, t)
    }

    const posts = read<{ posts: Record<string, any>[] }>('seed/posts.json')?.posts ?? []
    for (const p of posts) {
      run(`INSERT INTO posts (slug, title, date, category, summary, body, image_url, link_url, featured, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.slug, p.title, p.date, p.category, p.summary ?? '', p.body ?? '', p.image_url ?? null, p.link_url ?? null,
        p.featured ? 1 : 0, p.status ?? 'published', now(), now())
    }

    const events = read<{ events: Record<string, any>[] }>('seed/events.json')?.events ?? []
    for (const e of events) {
      run(`INSERT INTO events (slug, title, starts_on, ends_on, time_text, venue, address, map_url, summary, body, register_url, image_url, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        e.slug, e.title, e.starts_on ?? null, e.ends_on ?? null, e.time_text ?? null, e.venue ?? null, e.address ?? null, e.map_url ?? null,
        e.summary ?? '', e.body ?? '', e.register_url ?? null, e.image_url ?? null, e.status ?? 'published', now(), now())
    }

    const pubs = read<{ publications: Record<string, any>[] }>('seed/publications.json')?.publications ?? []
    for (const p of pubs) {
      let file: number | null = null
      const f = p.file ? path.join(config.seedDir, 'seed', 'files', p.file) : ''
      if (f && fs.existsSync(f)) file = storeLocal(f, p.access === 'members' ? 'members' : 'public', p.file)
      // listed even before its file is added (the library shows it as coming soon)
      run(`INSERT INTO publications (key, title, type, year, access, summary, file_id, link_url, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.key ?? null, p.title, p.type, p.year ?? null, p.access ?? 'public', p.summary ?? '', file, p.link_url ?? null,
        p.status ?? 'published', now(), now())
    }
    run(`INSERT INTO meta (key, value) VALUES ('seeded', ?)`, now())
    console.log(`[seed] ${members.length} members, ${posts.length} posts, ${events.length} events, ${pubs.length} publications`)
  })
}
