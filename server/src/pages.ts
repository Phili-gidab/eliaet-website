/* Pages with live content. The site is built as static pages (Astro); a few of them carry regions that come from the
   database, marked <template data-cms="name"></template> … <template data-cms-end="name"></template>. On each visit
   the server puts the current posts, events and publications between those marks, with the same HTML the build
   used (shared/render.ts). A post's or an event's page is a built template whose @@tokens@@ are filled in. */
import fs from 'node:fs'
import path from 'node:path'
import { Router, type Response } from 'express'
import { config } from './config.js'
import { one } from './db.js'
import { esc, plain } from '../../shared/markdown.js'
import { postCard, eventRow, pubRow, fmtDate, fmtRange, postBody } from '../../shared/render.js'
import { POST_CATEGORIES } from '../../shared/options.js'
import { posts, events, publications, postOut, srcset, today } from './content.js'
import { fileRef } from './files.js'
import { wrap, notFound } from './util.js'

const cache = new Map<string, { mtime: number; html: string }>()
function template(rel: string): string | null {
  const file = path.join(config.clientDist, rel)
  try {
    const { mtimeMs } = fs.statSync(file)
    const hit = cache.get(file)
    if (hit && hit.mtime === mtimeMs) return hit.html
    const html = fs.readFileSync(file, 'utf8')
    cache.set(file, { mtime: mtimeMs, html })
    return html
  } catch {
    return null
  }
}

/** Puts `inner` between a region's marks (the build may add its own attributes to them, so they are found by name).
    A page without that region is returned as it was. */
export function fill(html: string, name: string, inner: string): string {
  const a = new RegExp(`<template data-cms="${name}"[^>]*></template>`).exec(html)
  const b = new RegExp(`<template data-cms-end="${name}"[^>]*></template>`).exec(html)
  if (!a || !b || b.index < a.index) return html
  return html.slice(0, a.index + a[0].length) + inner + html.slice(b.index)
}

function tokens(html: string, values: Record<string, string>): string {
  return html.replace(/@@([a-z_]+)@@/g, (m, k: string) => (k in values ? values[k] : m))
}

function sendHtml(res: Response, html: string, status = 200) {
  res.status(status)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.send(html)
}

const TABS = new Set(['all', 'news', 'events', 'publications', 'spotlights'])
const PER = 9

export const pages = Router()

pages.get(['/', '/index.html'], wrap((_req, res, next) => {
  const html = template('index.html')
  if (!html) return next()
  const latest = posts({ limit: 3 }).items
  sendHtml(res, fill(html, 'home-news', latest.map((p, i) => postCard(p, i, srcset)).join('')))
}))

pages.get(['/news', '/news.html'], wrap((req, res, next) => {
  let html = template('news.html')
  if (!html) return next()
  const tab = TABS.has(String(req.query.tab)) ? String(req.query.tab) : 'all'
  const pg = Math.max(1, Number(req.query.page ?? 1) || 1)
  const asked = String(req.query.cat ?? '')
  const cat = tab === 'spotlights' ? 'member-spotlights' : asked in POST_CATEGORIES ? asked : undefined
  const list = posts({ category: cat, limit: PER, offset: (pg - 1) * PER })
  const pages = Math.max(1, Math.ceil(list.total / PER))
  const qs = (p: number) => `/news?${new URLSearchParams({ ...(tab !== 'all' ? { tab } : {}), ...(cat && tab !== 'spotlights' ? { cat } : {}), ...(p > 1 ? { page: String(p) } : {}) })}#news`
  const pager = pages > 1
    ? `<nav class="pager" aria-label="More posts">${pg > 1 ? `<a class="link" href="${qs(pg - 1)}">Newer posts</a>` : '<span></span>'}`
      + `<span class="label">Page ${pg} of ${pages}</span>${pg < pages ? `<a class="link" href="${qs(pg + 1)}">Older posts</a>` : '<span></span>'}</nav>`
    : ''
  html = html.replace('data-tab="all"', `data-tab="${tab}"`)
  html = fill(html, 'news', list.items.length
    ? list.items.map((p, i) => postCard(p, i, srcset)).join('')
    : `<p class="empty">${cat === 'member-spotlights' ? 'No member spotlights yet.' : cat ? 'Nothing in this category yet.' : 'No news yet.'}</p>`)
  html = fill(html, 'news-pager', pager)
  const evs = events()
  html = fill(html, 'events', evs.length ? evs.map(eventRow).join('') : '<li class="empty">No events are announced at the moment.</li>')
  const pubs = publications()
  html = fill(html, 'pubs', pubs.length ? pubs.map(pubRow).join('') : '<li class="empty">No publications yet.</li>')
  const years = [...new Set(pubs.map((p) => p.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
  html = fill(html, 'pub-years', `<option value="">All years</option>${years.map((y) => `<option>${y}</option>`).join('')}`)
  const featured = posts({ featured: true, limit: 2 }).items
  html = fill(html, 'featured', featured.map((p, i) => postCard(p, i, srcset)).join(''))
  sendHtml(res, html)
}))

pages.get('/news/:slug', wrap((req, res, next) => {
  const p = one(`SELECT * FROM posts WHERE slug = ? AND status = 'published'`, String(req.params.slug))
  if (!p) return next()
  const post = postOut(p)
  if (post.link_url && !post.body.trim()) return void res.redirect(302, post.link_url)
  const html = template('templates/news-post.html')
  if (!html) return next()
  const image = post.image ?? '/media/og/elia-og.jpg'
  const more = posts({ limit: 4 }).items.filter((x) => x.slug !== post.slug).slice(0, 3)
  sendHtml(res, fill(fill(tokens(html, {
    title: esc(post.title),
    description: esc(post.summary || plain(post.body, 180)),
    slug: esc(post.slug),
    category: esc(post.category),
    category_key: esc(post.categoryKey),
    date: esc(post.date ?? ''),
    date_text: esc(fmtDate(post.date, true)),
    image: esc(image.startsWith('http') ? image : config.siteUrl + image),
    image_src: post.image ? esc(post.image) : 'data:,',
    image_hidden: post.image ? '' : 'hidden',
    source_hidden: post.link_url ? '' : 'hidden',
    source: esc(post.link_url ?? ''),
  }), 'post-body', postBody(post.body || post.summary || '')), 'post-more', more.map((m, i) => postCard(m, i, srcset)).join('')))
}))

pages.get('/events/:slug', wrap((req, res, next) => {
  const slug = String(req.params.slug)
  if (slug.endsWith('.ics')) return next()
  const e = one(`SELECT * FROM events WHERE slug = ? AND status = 'published'`, slug)
  if (!e) return next()
  const html = template('templates/event.html')
  if (!html) return next()
  const past = !!e.starts_on && (e.ends_on ?? e.starts_on) < today()
  sendHtml(res, fill(tokens(html, {
    title: esc(e.title),
    description: esc(e.summary || plain(e.body, 180) || `${fmtRange(e.starts_on, e.ends_on)}${e.venue ? ', ' + e.venue : ''}`),
    slug: esc(e.slug),
    when: esc(fmtRange(e.starts_on, e.ends_on)),
    time: esc(e.time_text ?? ''),
    time_hidden: e.time_text ? '' : 'hidden',
    venue: esc(e.venue ?? 'To be announced'),
    address: esc(e.address ?? ''),
    map: esc(e.map_url || (e.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venue} ${e.address ?? ''} Addis Ababa`)}` : '')),
    map_hidden: e.venue ? '' : 'hidden',
    register: esc(e.register_url ?? ''),
    register_hidden: e.register_url && !past ? '' : 'hidden',
    ics_hidden: e.starts_on && !past ? '' : 'hidden',
    past_hidden: past ? '' : 'hidden',
    image: esc(config.siteUrl + (e.image_url || '/media/og/elia-og.jpg')),
  }), 'event-body', postBody(e.body || e.summary || '')))
}))

/** A publication's short address (/downloads/profile): its current file, or the library if it has none yet. A
    members-only file asks a visitor to sign in first (files.ts). */
pages.get('/downloads/:key', wrap((req, res) => {
  const p = one(`SELECT file_id, link_url FROM publications WHERE key = ? AND status = 'published'`, String(req.params.key).toLowerCase())
  const to = p ? fileRef(p.file_id)?.url ?? p.link_url : null
  res.setHeader('Cache-Control', 'no-cache')
  res.redirect(302, to || '/news?tab=publications#publications')
}))

/** An event as a calendar file ("Add to calendar"): all-day, in the Addis Ababa calendar day. */
pages.get('/events/:slug.ics', wrap((req, res) => {
  const e = one(`SELECT * FROM events WHERE slug = ? AND status = 'published'`, String(req.params.slug))
  if (!e || !e.starts_on) throw notFound()
  const d = (s: string) => s.replace(/-/g, '')
  const end = new Date(Date.parse((e.ends_on ?? e.starts_on) + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
  const txt = (s: string) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ELIA//Website//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${e.slug}@eliaet.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${d(e.starts_on)}`, `DTEND;VALUE=DATE:${d(end)}`,
    `SUMMARY:${txt(e.title)}`, e.venue ? `LOCATION:${txt([e.venue, e.address].filter(Boolean).join(', '))}` : '',
    `DESCRIPTION:${txt(plain(e.summary || e.body, 600) + (e.time_text ? `\n${e.time_text}` : '') + `\n${config.siteUrl}/events/${e.slug}`)}`,
    `URL:${config.siteUrl}/events/${e.slug}`, 'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n') + '\r\n'
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${e.slug}.ics"`)
  res.send(ics)
}))

/** the categories as the news page's filter knows them */
export const categories = POST_CATEGORIES
