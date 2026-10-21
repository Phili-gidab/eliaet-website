/* The members directory (signed-in view): search by company name, product or keyword; filters for category, size,
   region, export capability and certification; a grid or a list, A to Z, 20 to a page (the content document).
   The address keeps the search, so the back button and a shared link work. */
import { useEffect, useRef, useState } from 'preact/hooks'
import { api, session, type User } from './api'
import { Loading, Empty, Msg, Btn, errorOf, initials, Icon } from './ui'
import { CATEGORIES, SIZES, REGION_FILTERS, EXPORT_STATUS, CERTIFICATIONS } from '../../../shared/options'

export type Card = {
  slug: string; name: string; category: string; categoryLabel: string; size: string | null; city: string | null; regionLabel: string | null
  products: string | null; export_status: keyof typeof EXPORT_STATUS | null; certifications: string[]; logo: string | null
}
type Result = { items: Card[]; total: number; page: number; pages: number; per: number }

const KEYS = ['q', 'category', 'size', 'region', 'export', 'cert', 'sort', 'page'] as const
type Filters = Record<(typeof KEYS)[number], string>
const read = (): Filters => {
  const q = new URLSearchParams(location.search)
  return Object.fromEntries(KEYS.map((k) => [k, q.get(k) ?? ''])) as Filters
}
const entries = <T extends object>(o: T) => Object.entries(o) as [string, string][]

function storedView(): 'grid' | 'list' {
  try { return localStorage.getItem('elia-dir-view') === 'list' ? 'list' : 'grid' } catch { return 'grid' }
}

export function Directory() {
  const [me, setMe] = useState<User | null>(null)
  const [f, setF] = useState<Filters>(read)
  const [view, setView] = useState<'grid' | 'list'>(storedView)
  const [res, setRes] = useState<Result | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const lastQ = useRef(f.q)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => { session().then(setMe).catch(() => {}) }, [])
  useEffect(() => {
    const onPop = () => setF(read())
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const typing = f.q !== lastQ.current
    lastQ.current = f.q
    const t = setTimeout(() => {
      const qs = new URLSearchParams(entries(f).filter(([, v]) => v))
      const url = location.pathname + (qs.toString() ? `?${qs}` : '')
      if (url !== location.pathname + location.search) history[typing ? 'replaceState' : 'pushState'](null, '', url)
      setLoading(true)
      api<Result>(`/member/directory?${qs}`)
        .then((r) => { setRes(r); setErr('') })
        .catch((e) => setErr(errorOf(e).message))
        .finally(() => setLoading(false))
    }, typing ? 280 : 0)
    return () => clearTimeout(t)
  }, [f])

  const set = (k: keyof Filters, v: string) => setF((o) => ({ ...o, [k]: v, page: k === 'page' ? v : '' }))
  const clear = () => setF({ q: '', category: '', size: '', region: '', export: '', cert: '', sort: f.sort, page: '' })
  const filtered = !!(f.q || f.category || f.size || f.region || f.export || f.cert)
  const go = (p: number) => { set('page', p > 1 ? String(p) : ''); top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const pick = (v: 'grid' | 'list') => { setView(v); try { localStorage.setItem('elia-dir-view', v) } catch { /* private window */ } }

  const select = (k: keyof Filters, label: string, opts: [string, string][], all: string) => (
    <label class="field dir-f">
      <span>{label}</span>
      <select value={f[k]} onChange={(e) => set(k, (e.target as HTMLSelectElement).value)}>
        <option value="">{all}</option>
        {opts.map(([v, l]) => <option value={v}>{l}</option>)}
      </select>
    </label>
  )

  const first = res ? (res.page - 1) * res.per + 1 : 0
  const last = res ? Math.min(res.total, res.page * res.per) : 0

  return (
    <div class="dir" ref={top}>
      {me?.role === 'secretariat' && <Msg kind="info">You are signed in as the Secretariat: the directory shows what members see. <a href="/admin#companies">Manage members in the back office</a>.</Msg>}
      <form class="dir-tools" role="search" aria-label="Find a member" onSubmit={(e) => e.preventDefault()}>
        <label class="field dir-q">
          <span>Search</span>
          <span class="dir-q__box">
            {Icon.search}
            <input type="search" value={f.q} onInput={(e) => set('q', (e.target as HTMLInputElement).value)} maxLength={80}
              placeholder="Search by company name, product or keyword" autoComplete="off" spellcheck={false} />
          </span>
        </label>
        <div class="dir-fs">
          {select('category', 'Category', entries(CATEGORIES), 'All categories')}
          {select('size', 'Size', entries(SIZES), 'All sizes')}
          {select('region', 'Region', entries(REGION_FILTERS), 'All regions')}
          {select('export', 'Export capability', entries(EXPORT_STATUS), 'Any')}
          {select('cert', 'Certification', entries(CERTIFICATIONS), 'Any')}
        </div>
      </form>

      <div class="dir-bar">
        <p class="dir-count" role="status" aria-live="polite">
          {loading && !res ? 'Loading…' : res ? (res.total ? <>Showing <b>{first}–{last}</b> of <b>{res.total}</b> member{res.total === 1 ? '' : 's'}</> : 'No members match') : ''}
          {filtered && <Btn kind="plain" onClick={clear}>Clear the filters</Btn>}
        </p>
        <div class="dir-opts">
          <label class="dir-sort">
            <span class="sr-only">Sort</span>
            <select value={f.sort} onChange={(e) => set('sort', (e.target as HTMLSelectElement).value)}>
              <option value="">A to Z</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>
          <div class="seg" role="group" aria-label="Show as">
            <button type="button" aria-pressed={view === 'grid'} onClick={() => pick('grid')}>{Icon.grid}<span>Grid</span></button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => pick('list')}>{Icon.list}<span>List</span></button>
          </div>
        </div>
      </div>

      {err && <Msg kind="err">{err}</Msg>}
      {!err && loading && !res && <Loading />}
      {!err && res && res.items.length === 0 && (
        <Empty title="No members match.">
          <p>Try another word, or fewer filters.</p>
          {filtered && <Btn kind="ghost" onClick={clear}>Show all members</Btn>}
        </Empty>
      )}
      {!err && res && res.items.length > 0 && (
        <div class={`dir-results${loading ? ' is-loading' : ''}`} aria-busy={loading ? 'true' : undefined}>
          {view === 'grid' ? (
            <ul class="dgrid" role="list">
              {res.items.map((c) => <li><MemberCard c={c} /></li>)}
            </ul>
          ) : (
            <div class="table-wrap">
              <table class="dtable">
                <caption class="sr-only">Members, {res.total} found</caption>
                <thead><tr><th scope="col">Company</th><th scope="col">Category</th><th scope="col">Size</th><th scope="col">Location</th><th scope="col">Export</th><th scope="col">Certified</th></tr></thead>
                <tbody>
                  {res.items.map((c) => (
                    <tr>
                      <th scope="row"><a href={`/members/company/${c.slug}`}>{c.name}</a></th>
                      <td>{c.categoryLabel}</td>
                      <td>{c.size ? SIZES[c.size as keyof typeof SIZES] : '–'}</td>
                      <td>{[c.city, c.regionLabel].filter(Boolean).join(', ') || '–'}</td>
                      <td>{c.export_status ? EXPORT_STATUS[c.export_status] : '–'}</td>
                      <td>{c.certifications.length ? c.certifications.join(', ') : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {res.pages > 1 && (
            <nav class="pages" aria-label="Pages">
              <Btn kind="ghost" small disabled={res.page <= 1} onClick={() => go(res.page - 1)}>{Icon.back} Previous</Btn>
              <span class="pages__at">Page {res.page} of {res.pages}</span>
              <Btn kind="ghost" small disabled={res.page >= res.pages} onClick={() => go(res.page + 1)}>Next {Icon.arrow}</Btn>
            </nav>
          )}
        </div>
      )}
    </div>
  )
}

export function MemberCard({ c }: { c: Card }) {
  const place = [c.city, c.regionLabel].filter((x, i, a) => x && a.indexOf(x) === i).join(', ')
  return (
    <a class="dcard" href={`/members/company/${c.slug}`}>
      <span class="dcard__logo">{c.logo ? <img src={c.logo} alt="" loading="lazy" decoding="async" /> : <span class="mono" aria-hidden="true">{initials(c.name)}</span>}</span>
      <span class="dcard__body">
        <span class="dcard__name">{c.name}</span>
        <span class="dcard__meta">{c.categoryLabel}{c.size ? ` · ${SIZES[c.size as keyof typeof SIZES]}` : ''}</span>
        {place && <span class="dcard__place">{Icon.pin}{place}</span>}
        {c.products && <span class="dcard__prod">{c.products}</span>}
        {(c.certifications.length > 0 || c.export_status) && (
          <span class="dcard__tags">
            {c.certifications.map((x) => <span class={`tag${x === 'EHL' ? ' tag--ehl' : ''}`}>{x}</span>)}
            {c.export_status && c.export_status !== 'domestic' && <span class="tag tag--soft">{EXPORT_STATUS[c.export_status]}</span>}
          </span>
        )}
      </span>
    </a>
  )
}
