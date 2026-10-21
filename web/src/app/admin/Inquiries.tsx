/* The forms' inbox: every message the website's forms brought in, each kept with its reference, the team it went to
   and where it stands (new, open, done; spam to put aside). */
import { useRef, useState } from 'preact/hooks'
import { api, when } from '../api'
import { Loading, Msg, Btn, Area, useLoad, useSend } from '../ui'
import { Head, Table, Badge, Filters, Facts, mailto } from './kit'
import type { Options } from './Admin'

type Item = { id: number; ref: string; kind: string; team: string; name: string; email: string; organization: string; subject: string; status: string; created_at: string }
type List = { total: number; page: number; pages: number; items: Item[] }

const LABELS: Record<string, string> = {
  name: 'Name', organization: 'Organization', email: 'E-mail', phone: 'Phone', country: 'Country', subject: 'Subject', message: 'Message',
  company: 'Company', product: 'Product category', quantity: 'Quantity', quality: 'Quality requirements', delivery: 'Target delivery date',
  area: 'Investment area', size: 'Estimated investment size', location: 'Preferred location', interest: 'Interest', booth: 'Booth size',
  outlet: 'Media outlet', deadline: 'Deadline', request: 'Request', mobile: 'Mobile', sector: 'Sector', date: 'Preferred date',
}

export function Inquiries({ id, opts }: { id: string | null; opts: Options }) {
  return id ? <Inquiry id={id} opts={opts} /> : <InquiryList opts={opts} />
}

function InquiryList({ opts }: { opts: Options }) {
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const qs = new URLSearchParams({ ...(kind && { kind }), ...(status && { status }), ...(q && { q }), page: String(page) })
  const { data, error, loading } = useLoad(() => api<List>(`/admin/inquiries?${qs}`), [kind, status, q, page])
  const kinds = Object.entries(opts.inquiries)
  return (
    <div>
      <Head title="Inbox" sub="Messages from the website’s forms. The team each form is for has had it by e-mail too.">
        <a class="btn btn--ghost btn--sm" href={`/api/admin/inquiries/export.csv${kind ? `?kind=${kind}` : ''}`}>Download as a spreadsheet</a>
      </Head>
      <div class="atools">
        <label class="field"><span>Form</span>
          <select value={kind} onChange={(e) => { setKind((e.target as HTMLSelectElement).value); setPage(1) }}>
            <option value="">All forms</option>
            {kinds.map(([k, v]) => <option value={k}>{v.label}</option>)}
          </select>
        </label>
        <label class="field"><span>Search</span><input type="search" value={q} placeholder="Name, e-mail, subject or reference" onInput={(e) => { setQ((e.target as HTMLInputElement).value); setPage(1) }} /></label>
        <Filters label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1) }} options={[['', 'All but spam'], ['new', 'New'], ['open', 'Open'], ['done', 'Done'], ['spam', 'Spam']]} />
      </div>
      {error && <Msg kind="err">{error}</Msg>}
      {loading && !data && <Loading />}
      {data && (
        <>
          <Table rows={data.items} href={(r) => `#inquiries/${r.id}`} empty="No messages here."
            cols={[
              ['From', (r) => <><b>{r.name}</b>{r.organization && <span class="sub">{r.organization}</span>}</>],
              ['Form', (r) => opts.inquiries[r.kind]?.label ?? r.kind],
              ['Subject', (r) => r.subject],
              ['Received', (r) => <span class="nowrap">{when(r.created_at)}</span>],
              ['Status', (r) => <Badge v={r.status} />],
            ]} />
          {data.pages > 1 && (
            <nav class="pages" aria-label="Pages">
              <Btn kind="ghost" small disabled={page <= 1} onClick={() => setPage(page - 1)}>Newer</Btn>
              <span class="pages__at">Page {data.page} of {data.pages} · {data.total} messages</span>
              <Btn kind="ghost" small disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Older</Btn>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

type Full = Item & { data: Record<string, string | null>; note: string | null; handler: string | null; handled_at: string | null }

function Inquiry({ id, opts }: { id: string; opts: Options }) {
  const { data, error, loading, reload } = useLoad(() => api<Full>(`/admin/inquiries/${id}`), [id])
  const { busy, msg, run } = useSend()
  const f = useRef<HTMLFormElement>(null)
  if (loading && !data) return <Loading />
  if (error || !data) return <Msg kind="err">{error ?? 'Not found.'}</Msg>
  const set = (status: string) => run(() => api(`/admin/inquiries/${id}`, { method: 'PUT', body: { status, note: String(new FormData(f.current!).get('note') ?? '') } }), 'Saved.').then(reload)
  const form = opts.inquiries[data.kind]
  const reply = `mailto:${data.email}?subject=${encodeURIComponent(`Re: ${data.subject} (${data.ref})`)}`
  return (
    <div>
      <Head back="#inquiries" title={data.subject || form?.label} sub={<>{form?.label} · reference <b>{data.ref}</b> · for {opts.teams[data.team] ?? data.team} · {when(data.created_at)}</>}>
        <Badge v={data.status} />
      </Head>
      <div class="acols">
        <section class="abox">
          <h2 class="abox__h">The message</h2>
          <Facts rows={Object.entries(data.data).map(([k, v]) => [LABELS[k] ?? k, k === 'email' ? mailto(v) : v ? <span class="pre">{v}</span> : null])} />
        </section>
        <form class="abox" ref={f} onSubmit={(e) => e.preventDefault()}>
          <h2 class="abox__h">Handling</h2>
          <p class="row"><a class="btn btn--dark btn--sm" href={reply}>Reply by e-mail</a></p>
          <Area label="Note for the team" name="note" defaultValue={data.note ?? ''} rows={4} optional hint="Seen only in the back office" />
          {data.handler && <p class="small">Last changed by {data.handler}, {when(data.handled_at)}.</p>}
          <div class="row">
            {data.status !== 'open' && <Btn small kind="ghost" busy={busy} onClick={() => set('open')}>Mark as open</Btn>}
            {data.status !== 'done' && <Btn small busy={busy} onClick={() => set('done')}>Mark as done</Btn>}
            {data.status !== 'spam' && <Btn small kind="plain" busy={busy} onClick={() => set('spam')}>It is spam</Btn>}
            {data.status === 'spam' && <Btn small kind="ghost" busy={busy} onClick={() => set('new')}>Not spam</Btn>}
            <Btn small kind="plain" busy={busy} onClick={() => set(data.status)}>Save the note</Btn>
          </div>
          <Msg kind={msg?.kind ?? 'info'}>{msg?.text}</Msg>
        </form>
      </div>
    </div>
  )
}
