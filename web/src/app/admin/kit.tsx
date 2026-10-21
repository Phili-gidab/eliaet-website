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
  cols: [label: string, cell: (r: T) => ComponentChildren, cls?: string][]
  href?: (r: T) => string
  empty?: string
}) {
  if (!rows.length) return <p class="atable__empty">{empty}</p>
  return (
    <div class="table-wrap">
      <table class="atable">
        <thead><tr>{cols.map(([l, , c]) => <th scope="col" class={c}>{l}</th>)}</tr></thead>
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
