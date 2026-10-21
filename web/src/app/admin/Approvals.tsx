/* What waits for the Secretariat's answer: membership applications, requests for access to the members' area, and
   members' changes to their company profiles. */
import { useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { api, when, bytes } from '../api'
import { Loading, Msg, Btn, Area, useLoad, useSend, Empty } from '../ui'
import { Head, Table, Badge, Filters, Facts, mailto, go } from './kit'
import type { Options } from './Admin'

type FileRef = { id: number; url: string; name: string; size: number; mime?: string }

/* ---- membership applications ---- */

type AppItem = { id: number; company_name: string; contact_name: string; email: string; category: string; status: string; company_id: number | null; created_at: string }

export function Applications({ id, opts }: { id: string | null; opts: Options }) {
  return id ? <Application id={id} opts={opts} /> : <ApplicationList opts={opts} />
}

function ApplicationList({ opts }: { opts: Options }) {
  const [status, setStatus] = useState('')
  const { data, error, loading } = useLoad(() => api<{ items: AppItem[] }>(`/admin/applications${status ? `?status=${status}` : ''}`), [status])
  return (
    <div>
      <Head title="Membership applications" sub="From the application form on the Members and Contact pages. Accepting one makes the member company and invites its contact person." />
      <div class="atools"><Filters label="Status" value={status} onChange={setStatus} options={[['', 'All'], ['new', 'New'], ['reviewing', 'Reviewing'], ['accepted', 'Accepted'], ['declined', 'Declined']]} /></div>
      {error && <Msg kind="err">{error}</Msg>}
      {loading && !data && <Loading />}
      {data && (
        <Table rows={data.items} href={(r) => `#applications/${r.id}`} empty="No applications here."
          cols={[
            ['Company', (r) => r.company_name],
            ['Category', (r) => opts.categories[r.category] ?? r.category],
            ['Contact', (r) => <>{r.contact_name}<span class="sub">{r.email}</span></>],
            ['Received', (r) => <span class="nowrap">{when(r.created_at)}</span>],
            ['Status', (r) => <Badge v={r.status} />],
          ]} />
      )}
    </div>
  )
}

type AppFull = AppItem & { data: Record<string, string | number | null>; note: string | null; licence: FileRef | null; decided_at: string | null }

function Application({ id, opts }: { id: string; opts: Options }) {
  const { data: a, error, loading, reload } = useLoad(() => api<AppFull>(`/admin/applications/${id}`), [id])
  const { busy, msg, run } = useSend()
  const f = useRef<HTMLFormElement>(null)
  const [invite, setInvite] = useState(true)
  if (loading && !a) return <Loading />
  if (error || !a) return <Msg kind="err">{error ?? 'Not found.'}</Msg>
  const d = a.data
  const note = () => String(new FormData(f.current!).get('note') ?? '')
  const status = (s: string) => run(() => api(`/admin/applications/${id}`, { body: { status: s, note: note() } }), 'Saved.').then(reload)
  const accept = () => {
    if (!confirm(`Accept ${a.company_name} as a member company${invite ? ` and e-mail ${a.email} a link to set a password` : ''}?`)) return
    run(() => api<{ companyId: number }>(`/admin/applications/${id}/accept`, { body: { invite } })).then((r) => { if (r) go(`companies/${r.companyId}`) })
  }
  return (
    <div>
      <Head back="#applications" title={a.company_name} sub={<>Membership application{d.ref ? <> · reference <b>{String(d.ref)}</b></> : ''} · {when(a.created_at)}</>}>
        <Badge v={a.status} />
      </Head>
      <div class="acols">
        <section class="abox">
          <h2 class="abox__h">The application</h2>
          <Facts rows={[
            ['Company', d.companyName], ['Category', opts.categories[String(d.category)] ?? d.category], ['Size', opts.sizes[String(d.size)] ?? d.size],
            ['Year established', d.yearEstablished], ['Employees', d.employees], ['Region', opts.regions[String(d.region)] ?? d.region], ['Address', d.address],
            ['Main products', d.products && <span class="pre">{String(d.products)}</span>], ['Export markets', d.exportMarkets],
            ['Contact person', d.contactName], ['Position', d.position], ['Phone', d.phone], ['E-mail', mailto(String(d.email ?? a.email))],
            ['Message', d.message && <span class="pre">{String(d.message)}</span>],
            ['Trade licence', a.licence ? <a href={a.licence.url} target="_blank" rel="noopener">{a.licence.name} ({bytes(a.licence.size)})</a> : 'Not sent'],
          ]} />
        </section>
        <form class="abox" ref={f} onSubmit={(e) => e.preventDefault()}>
          <h2 class="abox__h">Decision</h2>
          {a.status === 'accepted' ? (
            <>
              <Msg kind="ok" live={false}>Accepted{a.decided_at ? ` on ${when(a.decided_at)}` : ''}.</Msg>
              {a.company_id && <p><a class="btn btn--dark btn--sm" href={`#companies/${a.company_id}`}>Open the member company</a></p>}
            </>
          ) : (
            <>
              <Area label="Note" name="note" defaultValue={a.note ?? ''} rows={3} optional hint="Seen only in the back office" />
              <label class="check"><input type="checkbox" checked={invite} onChange={(e) => setInvite((e.target as HTMLInputElement).checked)} /><span>Invite {a.contact_name} ({a.email}) to the members’ area</span></label>
              <div class="row">
                <Btn small busy={busy} onClick={accept}>Accept as a member</Btn>
                {a.status !== 'reviewing' && <Btn small kind="ghost" busy={busy} onClick={() => status('reviewing')}>Mark as reviewing</Btn>}
                {a.status !== 'declined' && <Btn small kind="plain" busy={busy} onClick={() => confirm('Decline this application? (No e-mail is sent; write to them yourself.)') && status('declined')}>Decline</Btn>}
              </div>
            </>
          )}
          <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
        </form>
      </div>
    </div>
  )
}

/* ---- access requests ---- */

type Req = {
  id: number; company_id: number | null; company_name: string; matched_company: string | null; name: string; position: string | null; email: string
  phone: string | null; message: string | null; status: string; note: string | null; invited_by_name: string | null; created_at: string
}

export function AccessRequests({ id }: { id: string | null }) {
  const [status, setStatus] = useState('pending')
  const { data, error, loading, reload } = useLoad(() => api<{ items: Req[] }>(`/admin/access?status=${status}`), [status])
  const companies = useLoad(() => api<{ items: { id: number; name: string; status: string }[] }>('/admin/companies-list'), [])
  const list = data?.items ?? []
  const focus = id ? Number(id) : null
  return (
    <div>
      <Head title="Access requests" sub="People of member companies asking for an account (up to three a company). Approving one e-mails them a link to set their password." />
      <div class="atools"><Filters label="Status" value={status} onChange={setStatus} options={[['pending', 'Waiting'], ['approved', 'Approved'], ['declined', 'Declined'], ['all', 'All']]} /></div>
      {error && <Msg kind="err">{error}</Msg>}
      {loading && !data && <Loading />}
      {data && !list.length && <Empty title={status === 'pending' ? 'No requests waiting.' : 'Nothing here.'} />}
      <ul class="cards" role="list">
        {list.map((r) => <li><AccessCard r={r} open={focus === r.id} companies={companies.data?.items ?? []} onDone={reload} /></li>)}
      </ul>
    </div>
  )
}

function AccessCard({ r, open, companies, onDone }: { r: Req; open: boolean; companies: { id: number; name: string }[]; onDone: () => void }) {
  const { busy, msg, errors, run } = useSend()
  const f = useRef<HTMLFormElement>(null)
  const get = (k: string) => new FormData(f.current!).get(k)
  const approve = () => run(() => api(`/admin/access/${r.id}/approve`, { body: { company_id: Number(get('company_id')) } }), 'Approved: the password link is on its way.').then((x) => x && onDone())
  const decline = () => run(() => api(`/admin/access/${r.id}/decline`, { body: { note: String(get('note') ?? ''), notify: get('notify') === 'on' } }), 'Declined.').then((x) => x && onDone())
  return (
    <form class={`acard${open ? ' is-open' : ''}`} ref={f} id={`access-${r.id}`} onSubmit={(e) => e.preventDefault()}>
      <div class="acard__top">
        <div>
          <p class="acard__t">{r.name}{r.position && <span class="sub"> · {r.position}</span>}</p>
          <p class="acard__s">{mailto(r.email)}{r.phone && <> · {r.phone}</>} · {when(r.created_at)}</p>
        </div>
        <Badge v={r.status} />
      </div>
      <p class="acard__co">
        For <b>{r.company_name}</b>
        {r.invited_by_name ? <> · asked by {r.invited_by_name}, of the company</> : r.matched_company ? <> · matches the member <b>{r.matched_company}</b></> : <span class="warn"> · no member company of that name on file: check it first</span>}
      </p>
      {r.message && <p class="acard__msg pre">{r.message}</p>}
      {r.note && <p class="acard__note">Note: {r.note}</p>}
      {r.status === 'pending' && (
        <div class="acard__do">
          <label class="field"><span>Member company</span>
            <select name="company_id" defaultValue={r.company_id ? String(r.company_id) : ''} aria-invalid={errors.company_id ? 'true' : undefined}>
              <option value="">Choose…</option>
              {companies.map((c) => <option value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div class="row"><Btn small busy={busy} onClick={approve}>Approve and send the link</Btn></div>
          <details class="acard__decline">
            <summary>Decline</summary>
            <Area label="Reason" name="note" rows={2} optional />
            <label class="check"><input type="checkbox" name="notify" /><span>E-mail the reason to {r.name}</span></label>
            <Btn small kind="ghost" busy={busy} onClick={decline}>Decline the request</Btn>
          </details>
        </div>
      )}
      <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
    </form>
  )
}

/* ---- profile changes ---- */

type ChangeItem = { id: number; company_id: number; company: string; status: string; note: string | null; created_at: string; by_name: string | null; fields: string[] }
type Row = { field: string; before: unknown; after: unknown }
type ChangeFull = { id: number; status: string; note: string | null; created_at: string; company: { id: number; name: string; slug: string }; rows: Row[]; by: { name: string; email: string } | null }

const NAMES: Record<string, string> = {
  name: 'Company name', year_established: 'Year established', city: 'City', region: 'Region', address: 'Address', lat: 'Latitude', lng: 'Longitude',
  products: 'Products', leather_types: 'Leather types', capacity: 'Production capacity', employees: 'Employees', export_status: 'Export capability',
  export_markets: 'Export markets', certifications: 'Certifications', contact_name: 'Contact person', contact_position: 'Position', phone: 'Phone',
  email: 'E-mail', website: 'Website', about: 'About', photos: 'Photos', logo: 'Logo',
}

export function Changes({ id }: { id: string | null }) {
  return id ? <Change id={id} /> : <ChangeList />
}

function ChangeList() {
  const [status, setStatus] = useState('pending')
  const { data, error, loading } = useLoad(() => api<{ items: ChangeItem[] }>(`/admin/changes?status=${status}`), [status])
  return (
    <div>
      <Head title="Profile changes" sub="Members’ changes to their company profiles show in the directory once approved." />
      <div class="atools"><Filters label="Status" value={status} onChange={setStatus} options={[['pending', 'Waiting'], ['approved', 'Approved'], ['rejected', 'Declined'], ['all', 'All']]} /></div>
      {error && <Msg kind="err">{error}</Msg>}
      {loading && !data && <Loading />}
      {data && (
        <Table rows={data.items} href={(r) => `#changes/${r.id}`} empty={status === 'pending' ? 'No changes waiting.' : 'Nothing here.'}
          cols={[
            ['Company', (r) => r.company],
            ['Changes', (r) => r.fields.map((k) => NAMES[k === 'logo_file_id' ? 'logo' : k] ?? k).join(', ')],
            ['By', (r) => r.by_name ?? ''],
            ['Sent', (r) => <span class="nowrap">{when(r.created_at)}</span>],
            ['Status', (r) => <Badge v={r.status} />],
          ]} />
      )}
    </div>
  )
}

function show(v: unknown): ComponentChildren {
  if (v === null || v === undefined || v === '') return <span class="none">empty</span>
  if (Array.isArray(v)) {
    if (!v.length) return <span class="none">none</span>
    if (typeof v[0] === 'object') return <span class="thumbs">{(v as FileRef[]).filter(Boolean).map((f) => <a href={f.url} target="_blank" rel="noopener"><img src={f.url} alt={f.name} /></a>)}</span>
    return v.join(', ')
  }
  if (typeof v === 'object') { const f = v as FileRef; return <span class="thumbs"><a href={f.url} target="_blank" rel="noopener"><img src={f.url} alt={f.name} /></a></span> }
  return <span class="pre">{String(v)}</span>
}

function Change({ id }: { id: string }) {
  const { data: c, error, loading, reload } = useLoad(() => api<ChangeFull>(`/admin/changes/${id}`), [id])
  const { busy, msg, run } = useSend()
  const f = useRef<HTMLFormElement>(null)
  if (loading && !c) return <Loading />
  if (error || !c) return <Msg kind="err">{error ?? 'Not found.'}</Msg>
  const approve = () => run(() => api(`/admin/changes/${id}/approve`, { method: 'POST' }), 'Approved: the profile is updated and the member told.').then(reload)
  const reject = () => run(() => api(`/admin/changes/${id}/reject`, { body: { note: String(new FormData(f.current!).get('note') ?? '') } }), 'Declined: the member has been told.').then(reload)
  return (
    <div>
      <Head back="#changes" title={c.company.name} sub={<>Profile change by {c.by?.name ?? 'a member'} · {when(c.created_at)}</>}>
        <Badge v={c.status} />
        <a class="btn btn--ghost btn--sm" href={`/members/company/${c.company.slug}`} target="_blank" rel="noopener">The profile now ↗</a>
      </Head>
      <div class="table-wrap">
        <table class="atable diff">
          <thead><tr><th scope="col">Field</th><th scope="col">Now</th><th scope="col">Proposed</th></tr></thead>
          <tbody>{c.rows.map((r) => <tr><th scope="row">{NAMES[r.field] ?? r.field}</th><td class="diff__was">{show(r.before)}</td><td class="diff__new">{show(r.after)}</td></tr>)}</tbody>
        </table>
      </div>
      {c.status === 'pending' ? (
        <form class="abox mt-s" ref={f} onSubmit={(e) => e.preventDefault()}>
          <div class="row"><Btn busy={busy} onClick={approve}>Approve and publish</Btn></div>
          <details class="acard__decline">
            <summary>Decline</summary>
            <Area label="Reason (e-mailed to the member)" name="note" rows={2} optional />
            <Btn small kind="ghost" busy={busy} onClick={reject}>Decline the changes</Btn>
          </details>
          <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
        </form>
      ) : (
        <p class="mt-s">{c.note && <>Note: {c.note}</>}</p>
      )}
      {msg && c.status !== 'pending' && <Msg kind={msg.kind}>{msg.text}</Msg>}
    </div>
  )
}
