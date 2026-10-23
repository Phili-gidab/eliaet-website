/* The member dashboard (the content document): My Profile (edit company details, products and photos; reviewed by
   the Secretariat before they show), Member Notices, Member Documents, Opportunities, Membership Status, and the
   account: the company's people and the password. Above the tabs, the company at a glance: its membership, its dues
   and where its profile stands. What the tabs show is loaded once here and shared. */
import { useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { api, session, loginUrl, day, bytes, type User } from './api'
import { Field, Area, Select, Checks, Msg, Btn, Loading, Empty, useLoad, useSend, useFocusInvalid, Icon, initials } from './ui'
import { ProfileView, type Profile, type FileRef } from './Company'
import { REGIONS, EXPORT_STATUS, CERTIFICATIONS } from '../../../shared/options'
import { markdown } from '../../../shared/markdown'

const TABS = [
  ['profile', 'My profile'],
  ['notices', 'Member notices'],
  ['documents', 'Member documents'],
  ['opportunities', 'Opportunities'],
  ['membership', 'Membership status'],
  ['account', 'Account'],
] as const
type Tab = (typeof TABS)[number][0]
const hashTab = (): Tab => {
  const h = location.hash.slice(1)
  return (TABS.find(([k]) => k === h)?.[0] ?? 'profile') as Tab
}
const entries = <T extends object>(o: T) => Object.entries(o) as [string, string][]
/** today in Addis Ababa */
const todayIso = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

type MeResp = {
  company: Profile | null
  pending: { id: number; fields: string[]; data: Record<string, unknown> & { photos?: FileRef[]; logo?: string | null }; created_at: string } | null
  lastDecision: { status: 'approved' | 'rejected'; note: string | null; decided_at: string } | null
  usersPerCompany: number
}
type Notice = { id: number; title: string; kind: string; kindLabel: string; body: string; published_on: string; file: FileRef | null }
type Opp = { id: number; title: string; kind: string; kindLabel: string; body: string; deadline: string | null; link_url: string | null; file: FileRef | null; published_on: string; closed: boolean }
type Loaded<T> = ReturnType<typeof useLoad<T>>

export function Dashboard() {
  const [me, setMe] = useState<User | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>(hashTab)
  useEffect(() => {
    session().then((u) => (u ? setMe(u) : location.assign(loginUrl()))).catch(() => setMe(null))
    const f = () => setTab(hashTab())
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  const member = !!me && me.role === 'member'
  const mine = useLoad(() => (member ? api<MeResp>('/member/me') : Promise.resolve(null)), [member])
  const notices = useLoad(() => (member ? api<{ items: Notice[] }>('/member/me/notices') : Promise.resolve(null)), [member])
  const opps = useLoad(() => (member ? api<{ items: Opp[] }>('/member/me/opportunities') : Promise.resolve(null)), [member])

  if (me === undefined) return <Loading />
  if (!me) return <Msg kind="err">The members’ area could not be reached. Please reload the page.</Msg>
  if (me.role === 'secretariat') {
    return (
      <div class="dash">
        <h1 class="sr-only">Member dashboard</h1>
        <Msg kind="info">You are signed in as the ELIA Secretariat. Members’ profiles, notices, documents and opportunities are managed in the back office.</Msg>
        <p class="row"><a class="btn btn--dark" href="/admin">Open the back office {Icon.arrow}</a><a class="btn btn--ghost" href="/members/directory">The directory</a></p>
      </div>
    )
  }
  const open = opps.data?.items.filter((o) => !o.closed).length ?? 0
  const count: Partial<Record<Tab, ComponentChildren>> = {
    notices: notices.data?.items.length || null,
    opportunities: open || null,
    profile: mine.data?.pending ? <span class="dtabs__wait" title="Changes waiting for review" /> : null,
    membership: mine.data?.company && duesState(mine.data.company).due ? <span class="dtabs__wait" title="Renewal is due" /> : null,
  }
  return (
    <div class="dash">
      <Hero me={me} mine={mine.data} />
      <nav class="dtabs" aria-label="Dashboard">
        {TABS.map(([k, l]) => (
          <a href={`#${k}`} aria-current={tab === k ? 'page' : undefined}>
            {l}{count[k] != null && (typeof count[k] === 'number' ? <span class="dtabs__n">{count[k]}</span> : count[k])}
          </a>
        ))}
      </nav>
      <section class="dash__panel" aria-labelledby="dash-h">
        {/* the tab's name heads its panel (for screen readers, which also find the items' headings under it) */}
        <h2 class="sr-only" id="dash-h">{TABS.find(([k]) => k === tab)?.[1]}</h2>
        {tab === 'profile' && <MyProfile mine={mine} />}
        {tab === 'notices' && <Notices list={notices} />}
        {tab === 'documents' && <Documents />}
        {tab === 'opportunities' && <Opportunities list={opps} />}
        {tab === 'membership' && <Membership mine={mine} />}
        {tab === 'account' && <Account me={me} />}
      </section>
    </div>
  )
}

export function SignOut({ small = true }: { small?: boolean }) {
  const [busy, setBusy] = useState(false)
  const out = async () => {
    setBusy(true)
    try { await api('/auth/logout', { method: 'POST', redirect401: false }) } catch { /* signed out anyway */ }
    location.assign('/members')
  }
  return <Btn kind="ghost" small={small} busy={busy} onClick={out}>Sign out</Btn>
}

/** where a company's dues stand: paid until when, due, or due soon (45 days) */
function duesState(c: Profile) {
  const until = c.dues_paid_until ?? null
  if (!until) return { until, due: false, soon: false, left: null as number | null }
  const left = daysBetween(todayIso(), until)
  return { until, due: left < 0, soon: left >= 0 && left <= 45, left }
}

/* ---- the company at a glance ---- */

function Hero({ me, mine }: { me: User; mine: MeResp | null }) {
  const c = mine?.company ?? null
  const dues = c ? duesState(c) : null
  const status = !c ? null : c.status === 'active' ? 'Active member' : c.status === 'suspended' ? 'Membership suspended' : 'Membership archived'
  return (
    <header class="dhero">
      <div class="dhero__main">
        <p class="dhero__hi">Welcome back, {me.name.split(/\s+/)[0]}</p>
        <h1 class="dhero__co">{me.company?.name ?? c?.name ?? 'Your company'}</h1>
        {c ? (
          <ul class="dhero__facts" role="list">
            <li><span class={`dot dot--${c.status === 'active' ? 'ok' : 'no'}`} aria-hidden="true" />{status}{c.member_since ? `, since ${c.member_since}` : ''}</li>
            <li>{dues!.due ? <b class="dhero__warn">Renewal is due</b> : dues!.until ? <>Dues paid until {day(dues!.until)}</> : 'Dues not on file'}</li>
            <li>{mine?.pending ? <a href="#profile">Profile changes waiting for review</a> : <>Profile {c.listed === false ? 'not listed' : 'published'}</>}</li>
          </ul>
        ) : mine && <p class="dhero__note">Not linked to a member company yet.</p>}
      </div>
      <div class="dhero__side">
        <span class="dhero__logo" aria-hidden="true">{c?.logo ? <img src={c.logo} alt="" /> : <span class="mono">{initials(me.company?.name ?? me.name)}</span>}</span>
        <div class="dhero__do">
          {c && <a class="btn btn--sm" href={`/members/company/${c.slug}`}>My public profile {Icon.out}</a>}
          <a class="btn btn--ghost btn--sm" href="/members/directory">{Icon.search} Find a member</a>
          <SignOut />
        </div>
      </div>
    </header>
  )
}

/* ---- my profile ---- */

const FIELD_NAMES: Record<string, string> = {
  name: 'company name', year_established: 'year established', city: 'city', region: 'region', address: 'address', lat: 'map pin', lng: 'map pin',
  products: 'products', leather_types: 'leather types', capacity: 'production capacity', employees: 'employees', export_status: 'export capability',
  export_markets: 'export markets', certifications: 'certifications', contact_name: 'contact person', contact_position: 'position',
  phone: 'phone', email: 'e-mail', website: 'website', about: 'about', photos: 'photos', logo_file_id: 'logo',
}
const fieldList = (f: string[]) => [...new Set(f.map((k) => FIELD_NAMES[k] ?? k))].join(', ')

function MyProfile({ mine }: { mine: Loaded<MeResp | null> }) {
  const { data, error, loading, reload } = mine
  const [preview, setPreview] = useState(false)
  if (loading && !data) return <Loading />
  if (error) return <Msg kind="err">{error}</Msg>
  if (!data?.company) return <Msg kind="info">Your account is not linked to a member company yet. Please <a href="/contact?form=general&subject=Members%27%20area#forms">contact the Secretariat</a>.</Msg>
  const c = data.company
  const p = data.pending
  const shown: Profile = p ? ({ ...c, ...p.data, photos: p.data.photos ?? c.photos, logo: 'logo' in p.data ? (p.data.logo as string | null) : c.logo } as Profile) : c
  return (
    <div class="mp">
      {p && (
        <div class="banner banner--wait">
          <p><b>Waiting for review.</b> Your changes of {day(p.created_at.slice(0, 10))} ({fieldList(p.fields)}) go to the directory once the Secretariat approves them. The form below shows them.</p>
          <WithdrawBtn onDone={reload} />
        </div>
      )}
      {!p && data.lastDecision && (
        <div class={`banner banner--${data.lastDecision.status === 'approved' ? 'ok' : 'no'}`}>
          <p>
            {data.lastDecision.status === 'approved' ? <><b>Published.</b> Your last changes were approved on {day(data.lastDecision.decided_at.slice(0, 10))}.</>
              : <><b>Not published.</b> Your last changes were declined on {day(data.lastDecision.decided_at.slice(0, 10))}.</>}
            {data.lastDecision.note && <> Note from the Secretariat: “{data.lastDecision.note}”</>}
          </p>
        </div>
      )}
      <div class="mp__bar">
        <p class="mp__lead">Your company as other members see it in the directory. Category and size are as registered with ELIA: to change them, write to the Secretariat.</p>
        <div class="seg" role="group" aria-label="Show">
          <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Edit</button>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
        </div>
      </div>
      {preview ? <div class="mp__preview"><ProfileView c={shown} preview /></div> : <ProfileForm key={p?.id ?? 0} c={c} v={shown} onSent={() => { reload(); scrollTo({ top: 0, behavior: 'smooth' }) }} />}
    </div>
  )
}

function WithdrawBtn({ onDone }: { onDone: () => void }) {
  const { busy, run } = useSend()
  return <Btn kind="ghost" small busy={busy} onClick={() => confirm('Withdraw the changes waiting for review?') && run(() => api('/member/me/company/withdraw', { method: 'POST' })).then(onDone)}>Withdraw them</Btn>
}

/** one part of the profile form: its name and what it is for on the left, its fields on the right */
function Part({ id, title, text, children }: { id: string; title: string; text: string; children: ComponentChildren }) {
  return (
    <section class="pform__part full" aria-labelledby={`pf-${id}`}>
      <div class="pform__side">
        <h3 class="pform__h" id={`pf-${id}`}>{title}</h3>
        <p class="pform__about">{text}</p>
      </div>
      <fieldset class="pform__fields" aria-labelledby={`pf-${id}`}>{children}</fieldset>
    </section>
  )
}

function ProfileForm({ c, v, onSent }: { c: Profile; v: Profile; onSent: () => void }) {
  const form = useRef<HTMLFormElement>(null)
  const { busy, msg, errors, run } = useSend()
  useFocusInvalid(errors, form)
  const [photos, setPhotos] = useState<FileRef[]>(v.photos ?? [])
  const [newPhotos, setNewPhotos] = useState<File[]>([])
  const [logoGone, setLogoGone] = useState(false)
  const [logoNew, setLogoNew] = useState<File | null>(null)
  const room = 4 - photos.length
  const val = (k: keyof Profile) => (v[k] == null ? '' : String(v[k]))

  const pickPhotos = (e: Event) => {
    const input = e.target as HTMLInputElement
    const list = [...(input.files ?? [])].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type) && f.size <= 4 * 1048576)
    setNewPhotos(list.slice(0, room))
  }
  const submit = (e: Event) => {
    e.preventDefault()
    const fd = new FormData(form.current!)
    fd.delete('photos'); fd.delete('logo')
    newPhotos.forEach((f) => fd.append('photos', f))
    if (logoNew) fd.append('logo', logoNew)
    fd.set('keepPhotos', photos.map((p) => String(p.id)).join(','))
    if (logoGone && !logoNew) fd.set('removeLogo', 'true')
    run(() => api('/member/me/company', { form: fd }), 'Sent. The Secretariat will review your changes before they appear in the directory.').then((r) => { if (r) onSent() })
  }

  return (
    <form ref={form} class="form pform" onSubmit={submit} noValidate>
      <Part id="company" title="Company" text="Your company’s name, history and size, as other members see them.">
        <Field label="Company name" name="name" defaultValue={val('name')} required maxLength={200} errors={errors} full />
        <p class="pform__fixed full"><span>Category</span>{c.categoryLabel}<span>Size</span>{c.sizeLabel ?? 'Not set'}</p>
        <Field label="Year established" name="year_established" type="number" inputMode="numeric" min={1900} max={new Date().getFullYear()} defaultValue={val('year_established')} errors={errors} optional />
        <Field label="Employees" name="employees" type="number" inputMode="numeric" min={0} defaultValue={val('employees')} errors={errors} optional hint="Permanent staff" />
        <Area label="About the company" name="about" defaultValue={val('about')} maxLength={2000} rows={4} errors={errors} optional />
      </Part>

      <Part id="products" title="Products and markets" text="What you make and where you sell it. Buyers ELIA refers to you read this first.">
        <Area label="Main products" name="products" defaultValue={val('products')} maxLength={600} rows={3} errors={errors} optional />
        <Field label="Leather types" name="leather_types" defaultValue={val('leather_types')} maxLength={300} errors={errors} optional hint="e.g. sheepskin, goatskin, cowhide; wet-blue, crust, finished" full />
        <Field label="Production capacity" name="capacity" defaultValue={val('capacity')} maxLength={160} errors={errors} optional hint="Monthly output: pairs, square feet or pieces" />
        <Select label="Export capability" name="export_status" options={entries(EXPORT_STATUS)} empty="Not said" defaultValue={val('export_status')} errors={errors} optional />
        <Field label="Export markets" name="export_markets" defaultValue={val('export_markets')} maxLength={400} errors={errors} optional hint="Countries currently served" full />
        <Checks label="Certifications" name="certifications" options={entries(CERTIFICATIONS)} value={v.certifications ?? []} errors={errors} />
      </Part>

      <Part id="location" title="Location" text="Where to find you. A map pin shows your place on a map in your profile.">
        <Select label="Region" name="region" options={entries(REGIONS)} empty="Choose…" defaultValue={val('region')} errors={errors} optional />
        <Field label="City" name="city" defaultValue={val('city')} maxLength={80} errors={errors} optional />
        <Field label="Address" name="address" defaultValue={val('address')} maxLength={240} errors={errors} optional full />
        <Field label="Map pin: latitude" name="lat" inputMode="decimal" defaultValue={val('lat')} errors={errors} optional hint="e.g. 8.5899" />
        <Field label="Map pin: longitude" name="lng" inputMode="decimal" defaultValue={val('lng')} errors={errors} optional hint="e.g. 39.1262" />
      </Part>

      <Part id="contact" title="Contact" text="Who members and buyers should reach, and how.">
        <Field label="Contact person" name="contact_name" defaultValue={val('contact_name')} maxLength={120} errors={errors} optional />
        <Field label="Position" name="contact_position" defaultValue={val('contact_position')} maxLength={120} errors={errors} optional />
        <Field label="Phone" name="phone" type="tel" defaultValue={val('phone')} maxLength={80} errors={errors} optional />
        <Field label="E-mail" name="email" type="email" defaultValue={val('email')} maxLength={160} errors={errors} optional />
        <Field label="Website" name="website" inputMode="url" defaultValue={val('website')} maxLength={400} errors={errors} optional full />
      </Part>

      <Part id="pictures" title="Logo and photos" text="Your logo, and up to four photos of your products or your factory.">
        <div class="pform__logo full">
          <span class="pform__logoimg">{v.logo && !logoGone && !logoNew ? <img src={v.logo} alt="Your logo" /> : logoNew ? <span class="pform__new">{logoNew.name}</span> : <span class="pform__none">No logo</span>}</span>
          <label class="btn btn--ghost btn--sm pform__file">
            {v.logo ? 'Replace the logo' : 'Add a logo'}
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; setLogoNew(f && f.size <= 4 * 1048576 ? f : null); setLogoGone(false) }} />
          </label>
          {v.logo && !logoGone && <Btn kind="plain" onClick={() => { setLogoGone(true); setLogoNew(null) }}>Remove the logo</Btn>}
          {errors.logo && <span class="err">{errors.logo}</span>}
        </div>
        <div class="full">
          <ul class="pform__photos" role="list">
            {photos.map((p) => (
              <li><img src={p.url} alt="" /><button type="button" class="pform__x" aria-label={`Remove photo ${p.name}`} onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}>{Icon.x}</button></li>
            ))}
            {newPhotos.map((f) => <li class="is-new"><span>{f.name}</span></li>)}
          </ul>
          {room > 0 && (
            <label class="btn btn--ghost btn--sm pform__file">
              Add photos ({room} more)
              <input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple onChange={pickPhotos} />
            </label>
          )}
          <p class="hint">PNG, JPG or WebP, up to 4 MB each; four photos at most.</p>
          {errors.photos && <span class="err">{errors.photos}</span>}
        </div>
      </Part>

      {/* stays in reach at the foot of the screen while the form is long */}
      <div class="form__end full pform__send">
        <Btn type="submit" busy={busy}>Send for review {Icon.arrow}</Btn>
        <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
      </div>
    </form>
  )
}

/* ---- what ELIA shares with members ---- */

/** a date as a calendar leaf: the day large, the month and year under it */
function Leaf({ iso }: { iso: string }) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return (
    <time class="leaf" datetime={iso.slice(0, 10)}>
      <b>{d.getUTCDate()}</b>
      <span>{d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span>
      <span>{d.getUTCFullYear()}</span>
    </time>
  )
}

function Notices({ list }: { list: Loaded<{ items: Notice[] } | null> }) {
  const { data, error, loading } = list
  if (loading && !data) return <Loading />
  if (error) return <Msg kind="err">{error}</Msg>
  if (!data?.items.length) return <Empty title="No notices yet.">Circulars, policy updates and meeting invitations from ELIA appear here.</Empty>
  return (
    <ul class="feed" role="list">
      {data.items.map((n) => (
        <li class="feed__item">
          <Leaf iso={n.published_on} />
          <div class="feed__main">
            <p class="feed__meta"><span class="tag tag--soft">{n.kindLabel}</span></p>
            <h3 class="feed__t">{n.title}</h3>
            {n.body && <div class="prose feed__body" dangerouslySetInnerHTML={{ __html: markdown(n.body) }} />}
            {n.file && <p><a class="filelink" href={n.file.url} target="_blank" rel="noopener">{Icon.file} {n.file.name} <span>{bytes(n.file.size)}</span></a></p>}
          </div>
        </li>
      ))}
    </ul>
  )
}

type Doc = { id: number; title: string; type: string; year: number | null; summary: string; file: FileRef | null; link_url: string | null; updated_at: string }
function Documents() {
  const { data, error, loading } = useLoad(() => api<{ items: Doc[] }>('/member/me/documents'), [])
  if (loading) return <Loading />
  if (error) return <Msg kind="err">{error}</Msg>
  if (!data?.items.length) return <Empty title="No members-only documents yet.">Reports, market studies and presentations for members appear here.</Empty>
  return (
    <ul class="docs" role="list">
      {data.items.map((d) => (
        <li class="doc">
          <span class="doc__i" aria-hidden="true">{Icon.file}</span>
          <div class="doc__text">
            <h3 class="doc__t">{d.title}</h3>
            <p class="doc__meta"><span class="tag tag--soft">{d.type}</span>{d.year && <span>{d.year}</span>}</p>
            {d.summary && <p class="doc__sum">{d.summary}</p>}
          </div>
          {d.file ? <a class="btn btn--ghost btn--sm doc__get" href={d.file.url} target="_blank" rel="noopener">Download · {bytes(d.file.size)} {Icon.down}</a>
            : d.link_url ? <a class="btn btn--ghost btn--sm doc__get" href={d.link_url} target="_blank" rel="noopener">Open {Icon.out}</a> : <span class="doc__soon">Coming soon</span>}
        </li>
      ))}
    </ul>
  )
}

function Opportunities({ list }: { list: Loaded<{ items: Opp[] } | null> }) {
  const { data, error, loading } = list
  if (loading && !data) return <Loading />
  if (error) return <Msg kind="err">{error}</Msg>
  if (!data?.items.length) return <Empty title="No opportunities at the moment.">Buyer inquiries, trade fair calls and training announcements shared by ELIA appear here.</Empty>
  const today = todayIso()
  return (
    <ul class="feed" role="list">
      {data.items.map((o) => {
        const left = o.deadline && !o.closed ? daysBetween(today, o.deadline) : null
        return (
          <li class={`feed__item${o.closed ? ' is-closed' : ''}`}>
            <Leaf iso={o.published_on} />
            <div class="feed__main">
              <p class="feed__meta">
                <span class="tag tag--soft">{o.kindLabel}</span>
                {o.deadline && <span class={`feed__due${o.closed ? ' is-closed' : left !== null && left <= 7 ? ' is-near' : ''}`}>
                  {o.closed ? `Closed ${day(o.deadline)}` : `Deadline ${day(o.deadline)}${left !== null ? left === 0 ? ', today' : left === 1 ? ', tomorrow' : `, in ${left} days` : ''}`}
                </span>}
              </p>
              <h3 class="feed__t">{o.title}</h3>
              {o.body && <div class="prose feed__body" dangerouslySetInnerHTML={{ __html: markdown(o.body) }} />}
              <p class="row">
                {o.link_url && <a class="btn btn--ghost btn--sm" href={o.link_url} target="_blank" rel="noopener">Details {Icon.out}</a>}
                {o.file && <a class="filelink" href={o.file.url} target="_blank" rel="noopener">{Icon.file} {o.file.name} <span>{bytes(o.file.size)}</span></a>}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ---- membership status: renewal date and dues ---- */

function Membership({ mine }: { mine: Loaded<MeResp | null> }) {
  const { data, error, loading } = mine
  if (loading && !data) return <Loading />
  if (error) return <Msg kind="err">{error}</Msg>
  const c = data?.company
  if (!c) return <Msg kind="info">Your account is not linked to a member company yet.</Msg>
  const { until, due, soon, left } = duesState(c)
  const status = c.status === 'active' ? 'Active' : c.status === 'suspended' ? 'Suspended' : 'Archived'
  // how much of the year paid for is left (a year's dues, counted back from the date they run to)
  const share = left === null ? 0 : Math.max(0, Math.min(1, left / 365))
  return (
    <div class="ms">
      <dl class="ms__grid">
        <div class="ms__card"><dt>Membership</dt><dd><span class={`dot dot--${c.status === 'active' ? 'ok' : 'no'}`} aria-hidden="true" />{status}</dd></div>
        <div class="ms__card"><dt>Member since</dt><dd>{c.member_since ?? 'Not on file'}</dd></div>
        <div class={`ms__card${due ? ' is-due' : soon ? ' is-soon' : ''}`}>
          <dt>Dues paid until</dt>
          <dd>{until ? day(until) : 'Not on file'}</dd>
          {until && (
            <div class="ms__bar" role="img" aria-label={due ? 'Renewal is due' : `${left} days until renewal`}>
              <span style={`width:${(share * 100).toFixed(1)}%`} />
            </div>
          )}
          {due && <p class="ms__note">Renewal is due.</p>}
          {!due && left !== null && <p class={`ms__note${soon ? '' : ' ms__note--quiet'}`}>{left === 0 ? 'Renewal is today.' : `${left} days until renewal.`}</p>}
        </div>
      </dl>
      {c.dues_note && <p class="ms__dues"><b>From the Secretariat:</b> {c.dues_note}</p>}
      <p class="ms__help">For renewal, dues and receipts, contact the Secretariat: <a href="mailto:info@eliaet.com">info@eliaet.com</a>, +251 115 156 144 or +251 911 635 644.</p>
    </div>
  )
}

/* ---- account: the company's people, the password ---- */

type Team = {
  users: { id: number; name: string; position: string | null; email: string; status: string; last_login_at: string | null }[]
  pending: { id: number; name: string; position: string | null; email: string; created_at: string }[]
  max: number
}
function Account({ me }: { me: User }) {
  const team = useLoad(() => api<Team>('/member/me/team'), [])
  const inv = useSend()
  const pw = useSend()
  const invForm = useRef<HTMLFormElement>(null)
  const pwForm = useRef<HTMLFormElement>(null)
  useFocusInvalid(inv.errors, invForm)
  useFocusInvalid(pw.errors, pwForm)
  const t = team.data
  const active = t ? t.users.filter((u) => u.status === 'active').length : 0
  const room = t ? t.max - active - t.pending.length : 0

  const invite = (e: Event) => {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(invForm.current!).entries())
    inv.run(() => api('/member/me/team/invite', { body: f }), 'Sent to the Secretariat. Your colleague receives an e-mail to set a password once it is approved.')
      .then((r) => { if (r) { invForm.current!.reset(); team.reload() } })
  }
  const change = (e: Event) => {
    e.preventDefault()
    const f = new FormData(pwForm.current!)
    if (f.get('password') !== f.get('again')) { pw.setErrors({ again: 'The two passwords are not the same' }); return }
    pw.run(() => api('/auth/change-password', { body: { current: f.get('current'), password: f.get('password') } }), 'Your password has been changed. Other devices where you were signed in are signed out.')
      .then((r) => { if (r) pwForm.current!.reset() })
  }

  return (
    <div class="acct">
      <section class="acct__box" aria-labelledby="acct-team">
        <h3 class="acct__h" id="acct-team">People of {me.company?.name ?? 'your company'}</h3>
        <p class="acct__lead">Each member company may register up to {t?.max ?? 3} users. Access is approved by the ELIA Secretariat.</p>
        {team.loading && <Loading />}
        {team.error && <Msg kind="err">{team.error}</Msg>}
        {t && (
          <ul class="people" role="list">
            {t.users.map((u) => (
              <li>
                <span class="people__av" aria-hidden="true">{initials(u.name)}</span>
                <span class="people__who">
                  <b>{u.name}{u.id === me.id && ' (you)'}</b><span>{[u.position, u.email].filter(Boolean).join(' · ')}</span>
                  <span class="people__s">{u.status !== 'active' ? 'No longer active' : u.last_login_at ? `Last signed in ${day(u.last_login_at.slice(0, 10))}` : 'Not signed in yet'}</span>
                </span>
              </li>
            ))}
            {t.pending.map((u) => (
              <li class="is-wait">
                <span class="people__av" aria-hidden="true">{initials(u.name)}</span>
                <span class="people__who"><b>{u.name}</b><span>{[u.position, u.email].filter(Boolean).join(' · ')}</span><span class="people__s">Waiting for approval</span></span>
              </li>
            ))}
          </ul>
        )}
        {t && room > 0 && (
          <form ref={invForm} class="form acct__form" onSubmit={invite} noValidate>
            <p class="acct__sub full">Ask for an account for a colleague</p>
            <Field label="Name" name="name" required maxLength={120} errors={inv.errors} />
            <Field label="Position" name="position" maxLength={120} errors={inv.errors} optional />
            <Field label="E-mail" name="email" type="email" required maxLength={160} errors={inv.errors} />
            <Field label="Phone" name="phone" type="tel" maxLength={40} errors={inv.errors} optional />
            <div class="form__end full"><Btn type="submit" kind="dark" busy={inv.busy}>Send to the Secretariat</Btn><Msg kind={inv.msg?.kind ?? 'info'}>{inv.msg?.text}</Msg></div>
          </form>
        )}
        {t && room <= 0 && <p class="acct__full">Your company has all {t.max} accounts. To change who has one, write to the Secretariat.</p>}
      </section>

      <section class="acct__box" aria-labelledby="acct-pw">
        <h3 class="acct__h" id="acct-pw">Your password</h3>
        <p class="acct__lead">Signed in as {me.email}.</p>
        <form ref={pwForm} class="form acct__form" onSubmit={change} noValidate>
          <input type="email" name="username" autoComplete="username" value={me.email} hidden readOnly />
          <Field label="Current password" name="current" type="password" autoComplete="current-password" required errors={pw.errors} full />
          <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} errors={pw.errors} hint="At least 10 characters" />
          <Field label="New password again" name="again" type="password" autoComplete="new-password" required errors={pw.errors} />
          <div class="form__end full"><Btn type="submit" busy={pw.busy}>Change the password</Btn><Msg kind={pw.msg?.kind ?? 'info'}>{pw.msg?.text}</Msg></div>
        </form>
      </section>
    </div>
  )
}
