/* Member companies (their directory profiles, membership status and dues, logo and photos; a spreadsheet out and in)
   and the people with accounts (members of a company, or the Secretariat). */
import { useRef, useState } from 'preact/hooks'
import { api, when, day, formObject, type User } from '../api'
import { Loading, Msg, Btn, Field, Area, Select, Checks, useLoad, useSend, useFocusInvalid, Empty } from '../ui'
import { Head, Table, Badge, Filters, Facts, go } from './kit'
import type { Options } from './Admin'

type FileRef = { id: number; url: string; name: string; size: number }
type CompanyRow = { id: number; slug: string; name: string; category: string; size: string | null; city: string | null; region: string | null; status: string; listed: number; dues_paid_until: string | null; updated_at: string; users: number }
const entries = (o: Record<string, string>) => Object.entries(o) as [string, string][]
const CERTS: [string, string][] = [['EHL', 'EHL certified'], ['LWG', 'LWG certified'], ['ISO', 'ISO certified']]
const today = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10)

export function Companies({ id, opts, perCompany, query }: { id: string | null; opts: Options; perCompany: number; query?: URLSearchParams }) {
  if (id === 'new') return <CompanyForm opts={opts} />
  if (id === 'import') return <Import />
  return id ? <CompanyPage id={id} opts={opts} perCompany={perCompany} /> : <CompanyList opts={opts} dues={query?.get('dues') ?? ''} />
}

function CompanyList({ opts, dues: dues0 }: { opts: Options; dues: string }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [dues, setDues] = useState(dues0)
  const qs = new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(category && { category }), ...(dues && { dues }) })
  const { data, error, loading } = useLoad(() => api<{ items: CompanyRow[] }>(`/admin/companies?${qs}`), [q, status, category, dues])
  return (
    <div>
      <Head title="Member companies" sub="Their directory profiles, membership status and dues. Changes made here show at once.">
        <a class="btn btn--dark btn--sm" href="#companies/new">Add a company</a>
        <a class="btn btn--ghost btn--sm" href="#companies/import">Import a spreadsheet</a>
        <a class="btn btn--ghost btn--sm" href="/api/admin/companies/export.csv">Download all</a>
      </Head>
      <div class="atools">
        <label class="field"><span>Search</span><input type="search" value={q} placeholder="Name, city or e-mail" onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
        <label class="field"><span>Category</span>
          <select value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
            <option value="">All</option>{entries(opts.categories).map(([k, v]) => <option value={k}>{v}</option>)}
          </select>
        </label>
        <Filters label="Status" value={status} onChange={setStatus} options={[['', 'Current'], ['active', 'Active'], ['suspended', 'Suspended'], ['archived', 'Archived']]} />
        <Filters label="Dues" value={dues} onChange={setDues} options={[['', 'Any dues'], ['due', 'Dues due']]} />
      </div>
      {error && <Msg kind="err">{error}</Msg>}
      {loading && !data && <Loading />}
      {data && (
        <>
          <p class="small atools__count">{data.items.length} {data.items.length === 1 ? 'company' : 'companies'}</p>
          <Table rows={data.items} href={(r) => `#companies/${r.id}`} empty="No companies match."
            cols={[
              ['Company', (r) => <>{r.name}{!r.listed && <span class="sub">Not listed in the directory</span>}</>],
              ['Category', (r) => opts.categories[r.category] ?? r.category],
              ['Size', (r) => (r.size ? opts.sizes[r.size] : '–')],
              ['Location', (r) => [r.city, r.region ? opts.regions[r.region] : null].filter(Boolean).join(', ') || '–'],
              ['Accounts', (r) => `${r.users}`, 'num'],
              ['Dues paid until', (r) => (r.dues_paid_until ? <span class={r.dues_paid_until < today() ? 'warn' : undefined}>{day(r.dues_paid_until)}</span> : <span class="warn">Not on file</span>)],
              ['Status', (r) => <Badge v={r.status} />],
            ]} />
        </>
      )}
    </div>
  )
}

type Full = {
  company: Record<string, any> & { logo: string | null; logo_file_id: number | null; photos: FileRef[]; certifications: string[] }
  users: { id: number; name: string; position: string | null; email: string; phone: string | null; status: string; last_login_at: string | null; has_password: number }[]
  requests: { id: number; name: string; email: string; status: string; created_at: string }[]
  changes: { id: number; status: string; created_at: string }[]
}

function CompanyPage({ id, opts, perCompany }: { id: string; opts: Options; perCompany: number }) {
  const { data, error, loading, reload } = useLoad(() => api<Full>(`/admin/companies/${id}`), [id])
  if (loading && !data) return <Loading />
  if (error || !data) return <Msg kind="err">{error ?? 'Not found.'}</Msg>
  const c = data.company
  const active = data.users.filter((u) => u.status === 'active').length
  return (
    <div>
      <Head back="#companies" title={c.name} sub={<>{opts.categories[c.category]}{c.size ? ` · ${opts.sizes[c.size]}` : ''} · updated {when(c.updated_at)}</>}>
        <Badge v={c.status} />
        {c.status === 'active' && c.listed && <a class="btn btn--ghost btn--sm" href={`/members/company/${c.slug}`} target="_blank" rel="noopener">See it in the directory ↗</a>}
      </Head>
      <div class="acols acols--wide">
        <CompanyForm opts={opts} c={c} onSaved={reload} />
        <div>
          <Pictures c={c} onSaved={reload} />
          <section class="abox">
            <h2 class="abox__h">People ({active} of {perCompany})</h2>
            {data.users.length ? (
              <ul class="plist" role="list">
                {data.users.map((u) => (
                  <li><a href={`#people/${u.id}`}><b>{u.name}</b></a> <Badge v={u.status} /><span class="sub">{[u.position, u.email].filter(Boolean).join(' · ')}</span>
                    <span class="sub">{!u.has_password ? 'Has not set a password yet' : u.last_login_at ? `Last signed in ${when(u.last_login_at)}` : 'Not signed in yet'}</span></li>
                ))}
              </ul>
            ) : <p class="small">Nobody from this company has an account yet.</p>}
            {active < perCompany && <p><a class="btn btn--ghost btn--sm" href={`#people/new?company=${c.id}`}>Add a person</a></p>}
            {data.requests.some((r) => r.status === 'pending') && <p class="small">Waiting: {data.requests.filter((r) => r.status === 'pending').map((r) => <a href={`#access/${r.id}`}>{r.name}</a>)}</p>}
          </section>
          {data.changes.length > 0 && (
            <section class="abox">
              <h2 class="abox__h">Profile changes by the member</h2>
              <ul class="plist" role="list">{data.changes.map((ch) => <li><a href={`#changes/${ch.id}`}>{when(ch.created_at)}</a> <Badge v={ch.status} /></li>)}</ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function CompanyForm({ opts, c, onSaved }: { opts: Options; c?: Full['company']; onSaved?: () => void }) {
  const form = useRef<HTMLFormElement>(null)
  const { busy, msg, errors, run } = useSend()
  useFocusInvalid(errors, form)
  const v = (k: string) => (c?.[k] == null ? '' : String(c[k]))
  const submit = (e: Event) => {
    e.preventDefault()
    const body = formObject(form.current!)
    body.listed = (form.current!.elements.namedItem('listed') as HTMLInputElement).checked
    if (c) run(() => api(`/admin/companies/${c.id}`, { method: 'PUT', body }), 'Saved.').then((r) => r && onSaved?.())
    else run(() => api<{ id: number }>('/admin/companies', { body })).then((r) => r && go(`companies/${r.id}`))
  }
  return (
    <form ref={form} class="form abox" onSubmit={submit} noValidate>
      <h2 class="abox__h full">{c ? 'Profile and membership' : 'A new member company'}</h2>
      <Field label="Company name" name="name" defaultValue={v('name')} required maxLength={200} errors={errors} full />
      <Select label="Category" name="category" options={entries(opts.categories)} empty="Choose…" defaultValue={v('category')} required errors={errors} />
      <Select label="Size" name="size" options={entries(opts.sizes)} empty="Not set" defaultValue={v('size')} errors={errors} />
      <Select label="Membership" name="status" options={[['active', 'Active'], ['suspended', 'Suspended'], ['archived', 'Archived (removed)']]} defaultValue={v('status') || 'active'} errors={errors} />
      <label class="check"><input type="checkbox" name="listed" defaultChecked={c ? !!c.listed : true} /><span>Listed in the members directory</span></label>
      <Field label="Member since (year)" name="member_since" type="number" inputMode="numeric" min={1994} defaultValue={v('member_since')} errors={errors} optional />
      <Field label="Dues paid until" name="dues_paid_until" type="date" defaultValue={v('dues_paid_until')} errors={errors} optional />
      <Area label="Note on dues (the member sees it)" name="dues_note" defaultValue={v('dues_note')} rows={2} maxLength={300} errors={errors} optional />

      <p class="abox__sub full">Directory profile</p>
      <Field label="Year established" name="year_established" type="number" inputMode="numeric" defaultValue={v('year_established')} errors={errors} optional />
      <Field label="Employees" name="employees" type="number" inputMode="numeric" defaultValue={v('employees')} errors={errors} optional />
      <Area label="Main products" name="products" defaultValue={v('products')} rows={2} maxLength={600} errors={errors} optional />
      <Field label="Leather types" name="leather_types" defaultValue={v('leather_types')} maxLength={300} errors={errors} optional full />
      <Field label="Production capacity" name="capacity" defaultValue={v('capacity')} maxLength={160} errors={errors} optional />
      <Select label="Export capability" name="export_status" options={entries(opts.exportStatus)} empty="Not said" defaultValue={v('export_status')} errors={errors} optional />
      <Field label="Export markets" name="export_markets" defaultValue={v('export_markets')} maxLength={400} errors={errors} optional full />
      <Checks label="Certifications" name="certifications" options={CERTS} value={c?.certifications ?? []} errors={errors} />
      <Select label="Region" name="region" options={entries(opts.regions)} empty="Not set" defaultValue={v('region')} errors={errors} optional />
      <Field label="City" name="city" defaultValue={v('city')} maxLength={80} errors={errors} optional />
      <Field label="Address" name="address" defaultValue={v('address')} maxLength={240} errors={errors} optional full />
      <Field label="Latitude" name="lat" inputMode="decimal" defaultValue={v('lat')} errors={errors} optional />
      <Field label="Longitude" name="lng" inputMode="decimal" defaultValue={v('lng')} errors={errors} optional />
      <Field label="Contact person" name="contact_name" defaultValue={v('contact_name')} maxLength={120} errors={errors} optional />
      <Field label="Position" name="contact_position" defaultValue={v('contact_position')} maxLength={120} errors={errors} optional />
      <Field label="Phone" name="phone" defaultValue={v('phone')} maxLength={80} errors={errors} optional />
      <Field label="E-mail" name="email" type="email" defaultValue={v('email')} maxLength={160} errors={errors} optional />
      <Field label="Website" name="website" defaultValue={v('website')} maxLength={400} errors={errors} optional full />
      <Area label="About" name="about" defaultValue={v('about')} rows={3} maxLength={2000} errors={errors} optional />
      <Field label="Address on the site" name="slug" defaultValue={v('slug')} maxLength={80} errors={errors} optional full hint={c ? `/members/company/${c.slug}` : 'Made from the name if left empty'} />
      <div class="form__end full">
        <Btn type="submit" busy={busy}>{c ? 'Save' : 'Add the company'}</Btn>
        <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
      </div>
    </form>
  )
}

function Pictures({ c, onSaved }: { c: Full['company']; onSaved: () => void }) {
  const [keep, setKeep] = useState<FileRef[]>(c.photos)
  const { busy, msg, errors, run } = useSend()
  const form = useRef<HTMLFormElement>(null)
  const submit = (e: Event) => {
    e.preventDefault()
    const fd = new FormData(form.current!)
    fd.set('keepPhotos', keep.map((p) => p.id).join(','))
    run(() => api(`/admin/companies/${c.id}/files`, { form: fd }), 'Saved.').then((r) => { if (r) { form.current!.reset(); onSaved() } })
  }
  return (
    <form ref={form} class="abox" onSubmit={submit}>
      <h2 class="abox__h">Logo and photos</h2>
      <div class="pform__logo">
        <span class="pform__logoimg">{c.logo ? <img src={c.logo} alt="Logo" /> : <span class="pform__none">No logo</span>}</span>
        <label class="field"><span>{c.logo ? 'Replace the logo' : 'Add a logo'}</span><input type="file" name="logo" accept="image/png,image/jpeg,image/webp" /></label>
        {c.logo && <label class="check"><input type="checkbox" name="removeLogo" value="true" /><span>Remove the logo</span></label>}
      </div>
      <ul class="pform__photos" role="list">
        {keep.map((p) => <li><img src={p.url} alt="" /><button type="button" class="pform__x" aria-label="Remove this photo" onClick={() => setKeep(keep.filter((x) => x.id !== p.id))}>×</button></li>)}
      </ul>
      {keep.length < 4 && <label class="field"><span>Add photos ({4 - keep.length} more)</span><input type="file" name="photos" accept="image/png,image/jpeg,image/webp" multiple /></label>}
      {(errors.logo || errors.photos) && <p class="err">{errors.logo || errors.photos}</p>}
      <div class="row"><Btn type="submit" small busy={busy}>Save the pictures</Btn></div>
      <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
    </form>
  )
}

function Import() {
  const { busy, msg, run } = useSend()
  const [out, setOut] = useState<{ added: number; updated: number; skipped: string[] } | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const submit = (e: Event) => {
    e.preventDefault()
    run(() => api<{ added: number; updated: number; skipped: string[] }>('/admin/companies/import', { form: new FormData(form.current!) })).then((r) => r && setOut(r))
  }
  return (
    <div>
      <Head back="#companies" title="Import a spreadsheet" sub="Add member companies, or update them, from a CSV file (Excel: Save As, CSV UTF-8)." />
      <div class="acols">
        <form ref={form} class="abox" onSubmit={submit}>
          <ol class="steps-s">
            <li>Download <a href="/api/admin/companies/template.csv">the template</a>, or <a href="/api/admin/companies/export.csv">all members as they are now</a>.</li>
            <li>Fill in one company a row. Only <b>name</b> and <b>category</b> (tannery, footwear, leather goods, associate) are needed for a new company; empty cells leave a known company’s details as they are.</li>
            <li>Choose the file and import it. A company whose name is already on file is updated; any other is added.</li>
          </ol>
          <label class="field"><span>CSV file</span><input type="file" name="file" accept=".csv,text/csv" required /></label>
          <div class="row"><Btn type="submit" busy={busy}>Import</Btn></div>
          <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
        </form>
        {out && (
          <section class="abox">
            <h2 class="abox__h">Done</h2>
            <p>{out.added} added, {out.updated} updated{out.skipped.length ? `, ${out.skipped.length} skipped` : ''}.</p>
            {out.skipped.length > 0 && <ul class="plist">{out.skipped.map((s) => <li>{s}</li>)}</ul>}
            <p><a class="btn btn--ghost btn--sm" href="#companies">See the companies</a></p>
          </section>
        )}
      </div>
    </div>
  )
}

/* ---- people ---- */

type Person = { id: number; name: string; email: string; position: string | null; phone: string | null; role: 'member' | 'secretariat'; status: string; company_id: number | null; company: string | null; last_login_at: string | null; has_password: number; created_at: string }

export function People({ id, query, me }: { id: string | null; query: URLSearchParams; me: User }) {
  if (id === 'new') return <PersonForm company={query.get('company')} me={me} />
  return id ? <PersonPage id={id} me={me} /> : <PeopleList />
}

function PeopleList() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const { data, error, loading } = useLoad(() => api<{ items: Person[] }>(`/admin/users?${new URLSearchParams({ ...(q && { q }), ...(role && { role }) })}`), [q, role])
  return (
    <div>
      <Head title="People and accounts" sub="Members’ accounts (up to three a company) and the Secretariat’s. Nobody sees a password: a new account gets an e-mailed link to set one.">
        <a class="btn btn--dark btn--sm" href="#people/new">Add a person</a>
      </Head>
      <div class="atools">
        <label class="field"><span>Search</span><input type="search" value={q} placeholder="Name, e-mail or company" onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
        <Filters label="Role" value={role} onChange={setRole} options={[['', 'Everyone'], ['member', 'Members'], ['secretariat', 'Secretariat']]} />
      </div>
      {error && <Msg kind="err">{error}</Msg>}
      {loading && !data && <Loading />}
      {data && (
        <Table rows={data.items} href={(r) => `#people/${r.id}`} empty="Nobody matches."
          cols={[
            ['Name', (r) => <>{r.name}<span class="sub">{r.email}</span></>],
            ['Company', (r) => (r.role === 'secretariat' ? 'ELIA Secretariat' : r.company ?? '–')],
            ['Role', (r) => <Badge v={r.role} label={r.role === 'secretariat' ? 'Secretariat' : 'Member'} />],
            ['Last signed in', (r) => (!r.has_password ? <span class="warn">No password yet</span> : r.last_login_at ? when(r.last_login_at) : 'Never')],
            ['Status', (r) => <Badge v={r.status} />],
          ]} />
      )}
    </div>
  )
}

function PersonPage({ id, me }: { id: string; me: User }) {
  const { data, error, loading, reload } = useLoad(() => api<{ items: Person[] }>(`/admin/users`), [id])
  const p = data?.items.find((x) => String(x.id) === id)
  const link = useSend()
  if (loading && !data) return <Loading />
  if (error) return <Msg kind="err">{error}</Msg>
  if (!p) return <Msg kind="err">Not found.</Msg>
  return (
    <div>
      <Head back="#people" title={p.name} sub={<>{p.role === 'secretariat' ? 'ELIA Secretariat' : p.company ?? 'No company'} · account since {when(p.created_at)}</>}>
        <Badge v={p.status} />
      </Head>
      <div class="acols">
        <PersonForm p={p} me={me} onSaved={reload} />
        <section class="abox">
          <h2 class="abox__h">Password</h2>
          <Facts rows={[['Password', p.has_password ? 'Set' : 'Not set yet'], ['Last signed in', p.last_login_at ? when(p.last_login_at) : 'Never']]} />
          <p class="small">Sends {p.email} a new link to set a password (it works for 72 hours). Their current password keeps working until they use it.</p>
          <Btn small kind="ghost" busy={link.busy} disabled={p.status !== 'active'} onClick={() => link.run(() => api(`/admin/users/${p.id}/link`, { method: 'POST' }), 'Sent.')}>Send a password link</Btn>
          <Msg kind={link.msg?.kind ?? 'info'}>{link.msg?.text}</Msg>
        </section>
      </div>
    </div>
  )
}

function PersonForm({ p, company, me, onSaved }: { p?: Person; company?: string | null; me: User; onSaved?: () => void }) {
  const companies = useLoad(() => api<{ items: { id: number; name: string }[] }>('/admin/companies-list'), [])
  const form = useRef<HTMLFormElement>(null)
  const [role, setRole] = useState<'member' | 'secretariat'>(p?.role ?? 'member')
  const { busy, msg, errors, run } = useSend()
  useFocusInvalid(errors, form)
  const self = p?.id === me.id
  const submit = (e: Event) => {
    e.preventDefault()
    const body = formObject(form.current!)
    if (p) run(() => api(`/admin/users/${p.id}`, { method: 'PUT', body }), 'Saved.').then((r) => r && onSaved?.())
    else run(() => api<{ id: number }>('/admin/users', { body }), 'Added: a link to set a password is on its way.').then((r) => r && go(`people/${r.id}`))
  }
  const opts: [string, string][] = (companies.data?.items ?? []).map((c) => [String(c.id), c.name])
  return (
    <form ref={form} class="form abox" onSubmit={submit} noValidate>
      {!p && <Head back="#people" title="Add a person" sub="They receive an e-mail with a link to set their password." />}
      <Field label="Name" name="name" defaultValue={p?.name ?? ''} required maxLength={120} errors={errors} />
      <Field label="E-mail" name="email" type="email" defaultValue={p?.email ?? ''} required maxLength={160} errors={errors} />
      <Field label="Position" name="position" defaultValue={p?.position ?? ''} maxLength={120} errors={errors} optional />
      <Field label="Phone" name="phone" defaultValue={p?.phone ?? ''} maxLength={40} errors={errors} optional />
      <Select label="Role" name="role" options={[['member', 'Member of a company'], ['secretariat', 'ELIA Secretariat (back office)']]} value={role}
        onChange={(e) => setRole((e.target as HTMLSelectElement).value as 'member' | 'secretariat')} errors={errors} disabled={self} />
      {self && <input type="hidden" name="role" value="secretariat" />}
      {role === 'member' && (companies.data
        ? <Select label="Company" name="company_id" options={opts} empty="Choose…" defaultValue={p?.company_id ? String(p.company_id) : company ?? ''} errors={errors} />
        : <Loading />)}
      {p && <Select label="Account" name="status" options={[['active', 'Active'], ['disabled', 'Disabled (cannot sign in)']]} defaultValue={p.status} errors={errors} disabled={self} />}
      {p && self && <input type="hidden" name="status" value="active" />}
      <div class="form__end full">
        <Btn type="submit" busy={busy}>{p ? 'Save' : 'Add and send the link'}</Btn>
        <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
      </div>
      {!opts.length && role === 'member' && companies.data && <Empty title="No member companies yet."><a href="#companies/new">Add one first</a>.</Empty>}
    </form>
  )
}
