/* The parts of pages that come from the database (news cards, events, publications), as HTML. The same functions
   build the pages' first version (Astro, from the seed data) and fill them with the live data on every visit (the
   server, server/src/pages.ts), so the two never differ. Their styles are global: web/src/styles/cms.css. */
import { esc, markdown } from './markdown.js'

export interface CardPost {
  slug: string
  title: string
  category: string          // the label
  date?: string | null      // YYYY-MM-DD or YYYY-MM
  summary?: string
  image?: string | null
  href: string
  external?: boolean
  event?: boolean
}
export interface CardEvent {
  slug: string
  title: string
  starts_on?: string | null
  ends_on?: string | null
  time_text?: string | null
  venue?: string | null
  summary?: string
  href: string
}
export interface CardPublication {
  id: number
  title: string
  type: string
  year?: number | null
  access: 'public' | 'members'
  summary?: string
  url?: string | null       // the file (or link)
  size?: number | null
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = MONTHS.map((m) => m.slice(0, 3))

/** "2026-02-14" -> "14 Feb 2026"; "2026-02" -> "February 2026" */
export function fmtDate(d?: string | null, long = false): string {
  if (!d) return ''
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(d)
  if (!m) return d
  const [, y, mo, da] = m
  const month = (long ? MONTHS : SHORT)[Number(mo) - 1]
  return da ? `${Number(da)} ${month} ${y}` : `${MONTHS[Number(mo) - 1]} ${y}`
}

/** "12 to 15 November 2026", "15 November 2026", or "To be announced" */
export function fmtRange(a?: string | null, b?: string | null): string {
  if (!a) return 'Date to be announced'
  if (!b || b === a) return fmtDate(a, true)
  const [ya, ma, da] = a.split('-'), [yb, mb, db] = b.split('-')
  if (ya === yb && ma === mb) return `${Number(da)} to ${Number(db)} ${MONTHS[Number(ma) - 1]} ${ya}`
  if (ya === yb) return `${Number(da)} ${MONTHS[Number(ma) - 1]} to ${Number(db)} ${MONTHS[Number(mb) - 1]} ${ya}`
  return `${fmtDate(a, true)} to ${fmtDate(b, true)}`
}

const ARROW = 'M4 12h15m-6-6 6 6-6 6'
const OUT = 'M7 17 17 7M9 7h8v8'
const svg = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`

/** srcset for a picture under /media (supplied by the caller: the build and the server each know their files) */
export type Srcset = (src: string) => string | undefined

export function postCard(p: CardPost, i = 0, srcset?: Srcset): string {
  const ss = p.image && srcset ? srcset(p.image) : undefined
  const img = p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy" decoding="async"${ss ? ` srcset="${esc(ss)}" sizes="(max-width: 900px) 88vw, 420px"` : ''}>`
    : `<span class="nc__noimg" aria-hidden="true"></span>`
  const ext = p.external ? ' target="_blank" rel="noopener"' : ''
  return `<article class="nc card" data-reveal style="--d:${((i % 3) * 0.08).toFixed(2)}s" data-cat="${esc(p.category)}">`
    + `<a href="${esc(p.href)}"${ext} class="nc__a"><div class="nc__img frame">${img}`
    + (p.event ? `<span class="stamp nc__stamp"><i></i>Event</span>` : '') + `</div>`
    + `<div class="nc__meta"><span class="label">${esc(p.category)}</span>${p.date ? `<time class="label" datetime="${esc(p.date)}">${esc(fmtDate(p.date))}</time>` : ''}</div>`
    + `<h3 class="nc__title">${esc(p.title)}</h3>`
    + (p.summary ? `<p class="nc__ex">${esc(p.summary)}</p>` : '')
    + `<span class="link nc__more">${p.external ? 'Read on the source' : 'Read more'} ${svg(p.external ? OUT : ARROW)}</span></a></article>`
}

export function eventRow(e: CardEvent): string {
  const day = e.starts_on ? Number(e.starts_on.slice(8, 10)) : null
  const mon = e.starts_on ? SHORT[Number(e.starts_on.slice(5, 7)) - 1] : ''
  return `<li class="ev">`
    + `<span class="ev__date" aria-hidden="true">${day ? `<b class="figure-num">${day}</b><i>${esc(mon)} ${esc(e.starts_on!.slice(0, 4))}</i>` : '<b class="figure-num">TBA</b>'}</span>`
    + `<div class="ev__text"><h3 class="ev__title"><a href="${esc(e.href)}">${esc(e.title)}</a></h3>`
    + `<p class="ev__when">${esc(fmtRange(e.starts_on, e.ends_on))}${e.time_text ? ` · ${esc(e.time_text)}` : ''}</p>`
    + (e.venue ? `<p class="ev__venue">${esc(e.venue)}</p>` : '')
    + `</div><a class="ev__go" href="${esc(e.href)}" aria-label="${esc(e.title)}: details">${svg(ARROW)}</a></li>`
}

export function pubRow(p: CardPublication): string {
  const members = p.access === 'members'
  const size = p.size ? ` · ${p.size > 1048576 ? (p.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(p.size / 1024)) + ' kB'}` : ''
  const action = p.url
    ? `<a class="pub__get" href="${esc(p.url)}"${/^https?:/.test(p.url) ? ' target="_blank" rel="noopener"' : ''}>${members ? 'Members: download' : 'Download'}${size} ${svg('M12 4v12m-5-5 5 5 5-5M5 20h14')}</a>`
    : `<span class="pub__soon">Coming soon</span>`
  return `<li class="pub" data-type="${esc(p.type)}" data-year="${esc(p.year ?? '')}" data-access="${p.access}">`
    + `<div class="pub__text"><h3 class="pub__title">${esc(p.title)}</h3>${p.summary ? `<p class="pub__sum">${esc(p.summary)}</p>` : ''}</div>`
    + `<span class="pub__meta"><span class="pill pub__type">${esc(p.type)}</span>${p.year ? `<span class="label">${esc(p.year)}</span>` : ''}`
    + `<span class="pub__access${members ? ' is-members' : ''}">${members ? `${svg('M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z')} Members only` : 'Public'}</span></span>`
    + action + `</li>`
}

/** A post's page body (Markdown, rendered safely). */
export const postBody = (md: string) => markdown(md)
