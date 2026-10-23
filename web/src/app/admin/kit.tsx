/* The back office's own small parts: the address-bar route (#section/id), list tables, status badges, a page head. */
import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'

export type Route = { section: string; id: string | null; query: URLSearchParams }

/** #companies/12?tab=people → { section: 'companies', id: '12', query } */
export function parseRoute(): Route {
  const raw = location.hash.replace(/^#\/?/, '')
  const [path, q = ''] = raw.split('?')
  const [section = 'overview', id = null] = path.split('/').filter(Boolean)
  return { section: section || 'overview', id, query: new URLSearchParams(q) }
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(parseRoute)
  useEffect(() => {
    const f = () => { setR(parseRoute()); scrollTo({ top: 0 }) }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return r
}

export const go = (hash: string) => { location.hash = hash }

const TONES: Record<string, string> = {
  new: 'amber', pending: 'amber', reviewing: 'blue', open: 'blue', draft: 'grey', suspended: 'red', disabled: 'grey', declined: 'red',
  rejected: 'red', spam: 'grey', withdrawn: 'grey', archived: 'grey', accepted: 'green', approved: 'green', done: 'green', active: 'green',
  published: 'green', members: 'brown', public: 'grey', secretariat: 'brown', member: 'grey',
}
export function Badge({ v, label }: { v: string; label?: string }) {
  return <span class={`badge badge--${TONES[v] ?? 'grey'}`}>{label ?? v.charAt(0).toUpperCase() + v.slice(1)}</span>
}

export function Head({ title, sub, children, back }: { title: ComponentChildren; sub?: ComponentChildren; children?: ComponentChildren; back?: string }) {
  return (
    <header class="ah">
      <div>
        {back && <a class="ah__back" href={back}>← Back</a>}
        <h1 class="ah__t">{title}</h1>
        {sub && <p class="ah__sub">{sub}</p>}
      </div>
      {children && <div class="ah__tools">{children}</div>}
    </header>
  )
}

/** A list as a table: each row opens its item */
export function Table<T>({ rows, cols, href, empty = 'Nothing here.' }: {
  rows: T[]
  /** a label in brackets ('[Featured]') is for screen readers only */
  cols: [label: string, cell: (r: T) => ComponentChildren, cls?: string][]
  href?: (r: T) => string
  empty?: string
}) {
  if (!rows.length) return <p class="atable__empty">{empty}</p>
  return (
    <div class="table-wrap">
      <table class="atable">
        <thead><tr>{cols.map(([l, , c]) => { const sr = /^\[(.*)\]$/.exec(l); return <th scope="col" class={c}>{sr ? <span class="sr-only">{sr[1]}</span> : l}</th> })}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr class={href ? 'is-link' : undefined} onClick={href ? (e) => { if (!(e.target as HTMLElement).closest('a, button')) go(href(r)) } : undefined}>
              {cols.map(([, cell, c], i) => (i === 0 && href ? <th scope="row" class={c}><a href={href(r)}>{cell(r)}</a></th> : <td class={c}>{cell(r)}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Filter buttons above a list (status: pending · approved · all) */
export function Filters({ value, options, onChange, label }: { value: string; options: [string, string][]; onChange: (v: string) => void; label: string }) {
  return (
    <div class="seg seg--sm" role="group" aria-label={label}>
      {options.map(([v, l]) => <button type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  )
}

/** Label: value pairs */
export function Facts({ rows }: { rows: [string, ComponentChildren][] }) {
  return (
    <dl class="afacts">
      {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => <div><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  )
}

export const mailto = (e?: string | null) => (e ? <a href={`mailto:${e}`}>{e}</a> : null)

/* the back office's line icons (24 × 24, drawn in the text colour) */
const c = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
const ic = (d: string) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
export const AIcon: Record<string, ReturnType<typeof ic>> = {
  overview: ic('M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z'),
  inquiries: ic('M4 13l2.5-7h11L20 13v6H4zM4 13h5l1 2.5h4l1-2.5h5'),
  applications: ic('M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zm0 0v4h4M12 11v6M9 14h6'),
  access: ic(`${c(8, 12, 4)}M12 12h9M18 12v3M15.5 12v2`),
  changes: ic('M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4'),
  companies: ic('M4 20V9l6-3v14M10 20V4l10 4v12M2 20h20M14 11h2M14 15h2M6.5 12h1M6.5 16h1'),
  people: ic(`${c(9, 8, 3.5)}M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.8.7 3 2.5 3.5 5.2`),
  posts: ic('M5 4h12v16H7a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2M8.5 8h5M8.5 12h5M8.5 16h3'),
  events: ic('M4 7h16v13H4zM4 11h16M8 4v5M16 4v5'),
  publications: ic('M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9'),
  notices: ic('M4 10v4h3l7 4V6l-7 4zM17.5 9a3 3 0 0 1 0 6M7.5 14l1.5 5h2.5l-1-5'),
  opportunities: ic('M4 8h16v11H4zM9 8V5h6v3M4 13h16'),
  subscribers: ic('M4 6h16v12H4zM4 7l8 6 8-6'),
  directory: ic(`${c(11, 11, 6.5)}M16 16l4.5 4.5`),
  site: ic('M7 17 17 7M9 7h8v8'),
}
