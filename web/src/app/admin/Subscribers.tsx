/* The newsletter's subscribers (from the Contact page, the News page and the footer). Sending the newsletter itself
   is done from the Secretariat's own e-mail: download the list as a spreadsheet. */
import { useState } from 'preact/hooks'
import { api, when } from '../api'
import { Loading, Msg, Btn, useLoad, useSend } from '../ui'
import { Head, Table, Badge, Filters } from './kit'

type Sub = { id: number; email: string; interests: string[]; created_at: string; unsubscribed_at: string | null }

export function Subscribers() {
  const [q, setQ] = useState('')
  const [show, setShow] = useState('current')
  const { data, error, loading, reload } = useLoad(() => api<{ items: Sub[] }>(`/admin/subscribers${q ? `?q=${encodeURIComponent(q)}` : ''}`), [q])
  const del = useSend()
  const rows = (data?.items ?? []).filter((s) => (show === 'current' ? !s.unsubscribed_at : show === 'left' ? !!s.unsubscribed_at : true))
  const current = (data?.items ?? []).filter((s) => !s.unsubscribed_at).length
  const remove = (s: Sub) => confirm(`Remove ${s.email} from the list for good?`) && del.run(() => api(`/admin/subscribers/${s.id}`, { method: 'DELETE' })).then(reload)
  return (
    <div>
      <Head title="Newsletter subscribers" sub={`${current} subscribed. Each e-mail from the list should carry the way to unsubscribe that the confirmation gave them.`}>
        <a class="btn btn--ghost btn--sm" href="/api/admin/subscribers/export.csv">Download the list</a>
      </Head>
      <div class="atools">
        <label class="field"><span>Search</span><input type="search" value={q} placeholder="E-mail address" onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
        <Filters label="Show" value={show} onChange={setShow} options={[['current', 'Subscribed'], ['left', 'Unsubscribed'], ['all', 'All']]} />
      </div>
      {error && <Msg kind="err">{error}</Msg>}
      {del.msg?.kind === 'err' && <Msg kind="err">{del.msg.text}</Msg>}
      {loading && !data && <Loading />}
      {data && (
        <Table rows={rows} empty="Nobody here."
          cols={[
            ['E-mail', (s) => <a href={`mailto:${s.email}`}>{s.email}</a>],
            ['Interested as', (s) => s.interests.join(', ') || '–'],
            ['Since', (s) => when(s.created_at)],
            ['', (s) => (s.unsubscribed_at ? <Badge v="withdrawn" label="Unsubscribed" /> : null)],
            ['', (s) => <Btn small kind="plain" onClick={() => remove(s)}>Remove</Btn>],
          ]} />
      )}
    </div>
  )
}
