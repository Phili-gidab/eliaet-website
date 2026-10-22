/* The parts of pages that come from the database (news cards, events, publications), as HTML. The same functions
   build the pages' first version (Astro, from the seed data) and fill them with the live data on every visit (the
   server, server/src/pages.ts), so the two never differ. Their styles are global: web/src/styles/cms.css. */
import { esc, markdown } from './markdown.js'
import { LISTING, CATEGORY_NOTES, type Category } from './options.js'

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

/* ── the public members' listing (the members page) ─────────────────────── */

export interface CardMember {
  slug: string
  name: string
  category: string          // tannery, footwear, leather_goods, associate
  city?: string | null
  logo?: string | null
  phone?: string | null     // as the company gave it: "Tel +251-115-535-978 · Mobile +251-912-073-375"
  email?: string | null
  website?: string | null
  ehl?: boolean             // certified to the Ethiopian Highland Leather standard
}

const PHONE_LABEL: Record<string, string> = { tel: 'Tel', telephone: 'Tel', phone: 'Tel', office: 'Tel', mobile: 'Mobile', mob: 'Mobile', cell: 'Mobile', fax: 'Fax' }

/** "Tel +251-115-535-978 · Mobile +251-912-073-375" -> [{ label: 'Tel', value: '+251-115-535-978' }, …] */
export function phoneLines(s?: string | null): { label: string; value: string }[] {
  if (!s) return []
  return s.split(/\s*(?:·|;|,|\|)\s*|\s+\/\s+/).map((part) => {
    const m = /^(telephone|tel|phone|office|mobile|mob|cell|fax)\.?\s*:?\s*(.+)$/i.exec(part.trim())
    return m ? { label: PHONE_LABEL[m[1].toLowerCase()], value: m[2].trim() } : { label: 'Tel', value: part.trim() }
  }).filter((p) => p.value)
}

/** a company's initials, for a card without a logo: "Natural Footwear Studio" -> "NF" */
const initials = (name: string) => name.replace(/\b(PLC|P\.L\.C|S\.C|SC|Ltd|Co|and|the|of)\b\.?/gi, '').split(/[\s.&-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function memberCard(m: CardMember, i = 0): string {
  const phones = phoneLines(m.phone)
  const tel = (v: string) => v.replace(/[^\d+]/g, '')
  const web = m.website ? (/^https?:\/\//i.test(m.website) ? m.website : `https://${m.website}`) : ''
  const webShort = web.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
  const rows = phones.map((p) => `<div><dt>${esc(p.label)}</dt><dd>${p.label !== 'Fax' && tel(p.value).replace('+', '').length >= 6
    ? `<a href="tel:${esc(tel(p.value))}">${esc(p.value)}</a>` : esc(p.value)}</dd></div>`)
  // a long address may break before its @, never inside a word
  if (m.email) rows.push(`<div><dt>Email</dt><dd><a href="mailto:${esc(m.email)}">${esc(m.email).replace('@', '<wbr>@')}</a></dd></div>`)
  const meta = [m.city ? esc(m.city) : '', m.ehl ? `<a class="mem__ehl" href="/ehl">EHL certified</a>` : ''].filter(Boolean)
  return `<li class="mem" data-reveal style="--d:${((i % 3) * 0.06).toFixed(2)}s">`
    + `<div class="mem__logo">${m.logo ? `<img src="${esc(m.logo)}" alt="" loading="lazy" decoding="async">` : `<span class="mem__mono" aria-hidden="true">${esc(initials(m.name))}</span>`}</div>`
    + `<h4 class="mem__name">${esc(m.name)}</h4>`
    + (meta.length ? `<p class="mem__meta">${meta.join('<span aria-hidden="true"> · </span>')}</p>` : '')
    + (rows.length ? `<dl class="mem__dl">${rows.join('')}</dl>` : '')
    + (web ? `<a class="mem__web" href="${esc(web)}" target="_blank" rel="noopener">${esc(webShort)} ${svg(OUT)}<span class="sr-only"> (opens in a new tab)</span></a>` : '')
    + `</li>`
}

/** The listing: an index of the categories, then each category's companies (the three the old site had always, even
    when empty, so its addresses keep working; associates once there are some). */
export function memberRoster(list: CardMember[]): string {
  const keys = (Object.keys(LISTING) as Category[]).filter((k) => k !== 'associate' || list.some((m) => m.category === k))
  const by = (k: string) => list.filter((m) => m.category === k).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const pad = (n: number) => String(n).padStart(2, '0')
  const index = `<nav class="roster__index" aria-label="Members by sector" data-reveal><ol role="list">`
    + keys.map((k) => `<li><a href="#${LISTING[k].anchor}"><span class="roster__ix">${esc(LISTING[k].title)}</span>`
      + `<span class="roster__ixn">${by(k).length} listed</span>${svg('M12 4v15m-6-6 6 6 6-6')}</a></li>`).join('')
    + `</ol></nav>`
  return index + keys.map((k) => {
    const ms = by(k), a = LISTING[k].anchor
    return `<div class="roster__group" id="${a}" aria-labelledby="${a}-h">`
      + `<div class="roster__head" data-reveal><p class="roster__n" aria-hidden="true"><b class="figure-num">${pad(ms.length)}</b><span>listed</span></p>`
      + `<h3 class="roster__t" id="${a}-h">${esc(LISTING[k].title)}</h3><p class="roster__note">${esc(CATEGORY_NOTES[k])}</p></div>`
      + (ms.length ? `<ul class="roster__list" role="list">${ms.map((m, i) => memberCard(m, i)).join('')}</ul>`
        : `<p class="roster__empty">No companies are listed here yet.</p>`)
      + `</div>`
  }).join('')
}
