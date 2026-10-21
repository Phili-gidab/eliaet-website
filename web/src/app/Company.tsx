/* A member's profile in the directory (the content document's "Member Profile Template"): name and logo, category
   and size, year established, location with a map pin, products, capacity, employees, export markets,
   certifications, the contact person, phone, e-mail and website, and when the member last updated it. */
import type { ComponentChildren } from 'preact'
import { api, day } from './api'
import { Loading, Msg, useLoad, initials, Icon } from './ui'

export type FileRef = { id: number; url: string; name: string; size: number; mime?: string }
export type Profile = {
  id: number; slug: string; name: string; category: string; categoryLabel: string; size: string | null; sizeLabel: string | null
  year_established: number | null; city: string | null; region: string | null; regionLabel: string | null; address: string | null
  lat: number | null; lng: number | null; products: string | null; leather_types: string | null; capacity: string | null
  employees: number | null; export_status: string | null; exportLabel: string | null; export_markets: string | null
  certifications: string[]; contact_name: string | null; contact_position: string | null; phone: string | null; email: string | null
  website: string | null; about: string | null; logo: string | null; logo_file_id: number | null; photos: FileRef[]; updated_at: string
  member_since: number | null
  status?: string; listed?: boolean; dues_paid_until?: string | null; dues_note?: string | null
}

const CERT_NAME: Record<string, string> = { EHL: 'Ethiopian Highland Leather', LWG: 'Leather Working Group', ISO: 'ISO' }

export function Company() {
  const slug = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() ?? '')
  const { data, error, loading } = useLoad(() => api<{ company: Profile }>(`/member/directory/${encodeURIComponent(slug)}`), [])
  if (loading) return <Loading />
  if (error || !data) {
    return (
      <div class="cp">
        <Msg kind="err">{error ?? 'This member could not be found.'}</Msg>
        <p><a class="link" href="/members/directory">{Icon.back} Back to the directory</a></p>
      </div>
    )
  }
  const c = data.company
  document.title = `${c.name} · Members directory · ELIA`
  return <ProfileView c={c} />
}

export function ProfileView({ c, preview = false }: { c: Profile; preview?: boolean }) {
  const place = [c.city, c.regionLabel].filter((x, i, a) => x && a.indexOf(x) === i).join(', ')
  const mapQuery = c.lat != null && c.lng != null ? `${c.lat},${c.lng}` : [c.address, c.city, c.regionLabel, 'Ethiopia'].filter(Boolean).join(', ')
  const web = c.website ? c.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '') : ''
  const tel = (s: string) => s.replace(/[^\d+]/g, '')
  const rows: [string, ComponentChildren][] = [
    ['Category and size', [c.categoryLabel, c.sizeLabel].filter(Boolean).join(' · ')],
    ['Year established', c.year_established],
    ['Member of ELIA since', c.member_since],
    ['Location', place || c.address ? <>{c.address && <span class="cp__addr">{c.address}</span>}{place}</> : null],
    ['Products', c.products],
    ['Leather types', c.leather_types],
    ['Production capacity', c.capacity],
    ['Employees', c.employees != null ? c.employees.toLocaleString('en-GB') : null],
    ['Export', [c.exportLabel, c.export_markets].filter(Boolean).join(': ')],
    ['Certifications', c.certifications.length ? c.certifications.map((x) => CERT_NAME[x] ?? x).join(', ') : null],
  ]
  return (
    <article class="cp">
      {!preview && <p class="cp__back"><a class="link" href="/members/directory">{Icon.back} The directory</a></p>}
      <header class="cp__head">
        <span class="cp__logo">{c.logo ? <img src={c.logo} alt={`${c.name} logo`} /> : <span class="mono" aria-hidden="true">{initials(c.name)}</span>}</span>
        <div>
          <h1 class="cp__name">{c.name}</h1>
          <p class="cp__meta">{c.categoryLabel}{c.sizeLabel ? ` · ${c.sizeLabel}` : ''}{place ? ` · ${place}` : ''}</p>
          {c.certifications.length > 0 && <p class="cp__tags">{c.certifications.map((x) => <span class={`tag${x === 'EHL' ? ' tag--ehl' : ''}`}>{x} certified</span>)}</p>}
        </div>
      </header>

      <div class="cp__grid">
        <div class="cp__main">
          {c.about && <p class="cp__about">{c.about}</p>}
          <dl class="cp__facts">
            {rows.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => <div><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {c.photos.length > 0 && (
            <ul class="cp__photos" role="list" aria-label="Photos">
              {c.photos.map((p) => <li><a href={p.url} target="_blank" rel="noopener"><img src={p.url} alt={`${c.name}: photo`} loading="lazy" decoding="async" /></a></li>)}
            </ul>
          )}
        </div>
        <aside class="cp__side">
          <div class="cp__card">
            <h2 class="cp__h">Contact</h2>
            {c.contact_name && <p class="cp__person"><b>{c.contact_name}</b>{c.contact_position && <span>{c.contact_position}</span>}</p>}
            <ul class="cp__lines" role="list">
              {c.phone && c.phone.split(/\s*[·;]\s*|\s*,\s*(?=\+)/).filter(Boolean).map((p) => <li><span>Phone</span><a href={`tel:${tel(p.replace(/^[^+\d]*/, ''))}`}>{p}</a></li>)}
              {c.email && <li><span>E-mail</span><a href={`mailto:${c.email}`}>{c.email}</a></li>}
              {c.website && <li><span>Website</span><a href={c.website} target="_blank" rel="noopener">{web} {Icon.out}</a></li>}
            </ul>
            {!c.contact_name && !c.phone && !c.email && !c.website && <p class="cp__none">No contact details yet.</p>}
          </div>
          {mapQuery && (
            <div class="cp__map">
              {c.lat != null && c.lng != null && !preview ? (
                <iframe title={`Map: ${c.name}`} loading="lazy" referrerpolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`} />
              ) : null}
              <a class="link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noopener">{Icon.pin} Open in Maps</a>
            </div>
          )}
          <p class="cp__updated">Profile updated {day(c.updated_at.slice(0, 10))}</p>
        </aside>
      </div>
    </article>
  )
}
