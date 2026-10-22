/* What ELIA publishes, one pattern for all: news posts, events and publications (on the website), notices and
   opportunities (for signed-in members). Texts are written in a little Markdown; a post's or an event's page goes
   live at its own address as soon as it is published. */
import type { ComponentChildren } from 'preact'
import { useRef, useState } from 'preact/hooks'
import { api, day, bytes } from '../api'
import { Loading, Msg, Btn, Field, Area, Select, useLoad, useSend, useFocusInvalid } from '../ui'
import { Head, Table, Badge, Filters, go } from './kit'
import type { Options } from './Admin'
import { markdown } from '../../../../shared/markdown'

type FileRef = { id: number; url: string; name: string; size: number }
type Item = Record<string, any> & { id: number; title: string; file?: FileRef | null }

type Input =
  | { k: string; label: string; type: 'text' | 'url' | 'date' | 'number' | 'month'; req?: boolean; max?: number; hint?: string; full?: boolean; placeholder?: string }
  | { k: string; label: string; type: 'area' | 'markdown'; req?: boolean; max?: number; hint?: string; rows?: number }
  | { k: string; label: string; type: 'select'; options: (o: Options) => [string, string][]; req?: boolean; hint?: string }
  | { k: string; label: string; type: 'check'; hint?: string }
  | { k: string; label: string; type: 'file'; accept: string; hint: string }

type Spec = {
  title: string; one: string; sub: string; inputs: Input[]
  cols: (o: Options) => [string, (r: Item) => ComponentChildren][]
  link?: (r: Item) => string | null
  blank: Record<string, string>
  fileField?: string
}

const STATUS: Input = { k: 'status', label: 'Status', type: 'select', options: () => [['draft', 'Draft (not shown)'], ['published', 'Published']] }
const MD_HINT = 'Paragraphs; ## a heading; - a list; **bold**; [a link](https://…)'
const IMAGE_HINT = 'PNG, JPG or WebP, up to 4 MB. Wide pictures (16:9) suit the cards best.'
const DOC_HINT = 'PDF, Word, Excel or PowerPoint, up to 25 MB.'
const today = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10)

export const COLLECTIONS: Record<'posts' | 'events' | 'publications' | 'notices' | 'opportunities', Spec> = {
  posts: {
    title: 'News', one: 'post', sub: 'The News page, the home page’s latest three, and each post’s own page (/news/…).',
    fileField: 'image',
    inputs: [
      { k: 'title', label: 'Title', type: 'text', req: true, max: 200, full: true },
      { k: 'date', label: 'Date', type: 'text', req: true, placeholder: 'YYYY-MM-DD', hint: 'Or YYYY-MM for a month' },
      { k: 'category', label: 'Category', type: 'select', options: (o) => Object.entries(o.postCategories), req: true },
      { k: 'summary', label: 'Summary', type: 'area', max: 600, rows: 3, hint: 'On the cards and in link previews' },
      { k: 'body', label: 'Text', type: 'markdown', max: 40000, rows: 14, hint: MD_HINT },
      { k: 'image', label: 'Picture', type: 'file', accept: 'image/png,image/jpeg,image/webp', hint: IMAGE_HINT },
      { k: 'link_url', label: 'Link to an outside article', type: 'url', hint: 'With no text of its own, the post’s card opens this', full: true },
      { k: 'featured', label: 'Featured article (on the News page)', type: 'check' },
      { k: 'slug', label: 'Address', type: 'text', max: 90, hint: 'Made from the title if left empty', full: true },
      STATUS,
    ],
    cols: (o) => [['Title', (r) => r.title], ['Category', (r) => o.postCategories[r.category] ?? r.category], ['Date', (r) => day(r.date)],
      ['[Featured]', (r) => (r.featured ? <Badge v="members" label="Featured" /> : null)], ['Status', (r) => <Badge v={r.status} />]],
    link: (r) => (r.status === 'published' ? `/news/${r.slug}` : null),
    blank: { status: 'draft', category: 'announcements' },
  },
  events: {
    title: 'Events', one: 'event', sub: 'The events calendar on the News page, and each event’s own page with its map, registration and “Add to calendar”.',
    inputs: [
      { k: 'title', label: 'Title', type: 'text', req: true, max: 200, full: true },
      { k: 'starts_on', label: 'Starts', type: 'date', hint: 'Empty: date to be announced' },
      { k: 'ends_on', label: 'Ends', type: 'date', hint: 'For an event of several days' },
      { k: 'time_text', label: 'Time', type: 'text', max: 80, placeholder: 'e.g. 9:00 to 17:00' },
      { k: 'venue', label: 'Venue', type: 'text', max: 160 },
      { k: 'address', label: 'Address', type: 'text', max: 240, full: true },
      { k: 'map_url', label: 'Map link', type: 'url', hint: 'Empty: a map search for the venue', full: true },
      { k: 'register_url', label: 'Registration link', type: 'url', full: true },
      { k: 'summary', label: 'Summary', type: 'area', max: 600, rows: 3 },
      { k: 'body', label: 'Description', type: 'markdown', max: 20000, rows: 10, hint: MD_HINT },
      { k: 'image_url', label: 'Picture for link previews', type: 'text', max: 300, hint: 'An address on the site, e.g. /media/fair/hall.webp', full: true },
      { k: 'slug', label: 'Address', type: 'text', max: 90, hint: 'Made from the title if left empty', full: true },
      STATUS,
    ],
    cols: () => [['Title', (r) => r.title], ['When', (r) => (r.starts_on ? `${day(r.starts_on)}${r.ends_on && r.ends_on !== r.starts_on ? ` to ${day(r.ends_on)}` : ''}` : 'To be announced')],
      ['Venue', (r) => r.venue ?? ''], ['Status', (r) => <Badge v={r.status} />]],
    link: (r) => (r.status === 'published' ? `/events/${r.slug}` : null),
    blank: { status: 'draft' },
  },
  publications: {
    title: 'Publications', one: 'publication', sub: 'The publications library on the News page. Members-only documents are also in members’ dashboards.',
    fileField: 'file',
    inputs: [
      { k: 'title', label: 'Title', type: 'text', req: true, max: 200, full: true },
      { k: 'type', label: 'Type', type: 'select', options: (o) => o.publicationTypes.map((t) => [t, t]), req: true },
      { k: 'year', label: 'Year', type: 'number' },
      { k: 'access', label: 'Access', type: 'select', options: () => [['public', 'Public'], ['members', 'Members only']] },
      { k: 'summary', label: 'Summary', type: 'area', max: 1000, rows: 3 },
      { k: 'file', label: 'The document', type: 'file', accept: '.pdf,.docx,.xlsx,.pptx', hint: DOC_HINT },
      { k: 'link_url', label: 'Or a link to it', type: 'url', full: true },
      { k: 'key', label: 'Short address', type: 'text', max: 60, hint: 'e.g. profile: then /downloads/profile always opens this document’s current file', full: true },
      STATUS,
    ],
    cols: () => [['Title', (r) => r.title], ['Type', (r) => r.type], ['Year', (r) => r.year ?? ''], ['Access', (r) => <Badge v={r.access} label={r.access === 'members' ? 'Members only' : 'Public'} />],
      ['File', (r) => (r.file ? bytes(r.file.size) : r.link_url ? 'Link' : <span class="warn">None yet</span>)], ['Status', (r) => <Badge v={r.status} />]],
    link: (r) => (r.status === 'published' && r.key ? `/downloads/${r.key}` : null),
    blank: { status: 'published', access: 'public', type: 'Report', year: String(new Date().getFullYear()) },
  },
  notices: {
    title: 'Member notices', one: 'notice', sub: 'Circulars, policy updates and meeting invitations, in signed-in members’ dashboards.',
    fileField: 'file',
    inputs: [
      { k: 'title', label: 'Title', type: 'text', req: true, max: 200, full: true },
      { k: 'kind', label: 'Kind', type: 'select', options: (o) => Object.entries(o.noticeKinds), req: true },
      { k: 'published_on', label: 'Shown from', type: 'date', req: true },
      { k: 'body', label: 'Text', type: 'markdown', max: 20000, rows: 10, hint: MD_HINT },
      { k: 'file', label: 'A document', type: 'file', accept: '.pdf,.docx,.xlsx,.pptx', hint: DOC_HINT },
    ],
    cols: (o) => [['Title', (r) => r.title], ['Kind', (r) => o.noticeKinds[r.kind] ?? r.kind], ['Shown from', (r) => day(r.published_on)], ['File', (r) => (r.file ? bytes(r.file.size) : '')]],
    blank: { kind: 'circular', published_on: today() },
  },
  opportunities: {
    title: 'Opportunities', one: 'opportunity', sub: 'Buyer inquiries, trade fair calls and training announcements, in signed-in members’ dashboards.',
    fileField: 'file',
    inputs: [
      { k: 'title', label: 'Title', type: 'text', req: true, max: 200, full: true },
      { k: 'kind', label: 'Kind', type: 'select', options: (o) => Object.entries(o.opportunityKinds), req: true },
      { k: 'published_on', label: 'Shown from', type: 'date', req: true },
      { k: 'deadline', label: 'Deadline', type: 'date' },
      { k: 'body', label: 'Text', type: 'markdown', max: 20000, rows: 10, hint: MD_HINT },
      { k: 'link_url', label: 'Link', type: 'url', full: true },
      { k: 'file', label: 'A document', type: 'file', accept: '.pdf,.docx,.xlsx,.pptx', hint: DOC_HINT },
    ],
    cols: (o) => [['Title', (r) => r.title], ['Kind', (r) => o.opportunityKinds[r.kind] ?? r.kind], ['Deadline', (r) => (r.deadline ? day(r.deadline) : '')], ['Shown from', (r) => day(r.published_on)]],
    blank: { kind: 'buyer', published_on: today() },
  },
}

export function Content({ name, id, opts }: { name: keyof typeof COLLECTIONS; id: string | null; opts: Options }) {
  const spec = COLLECTIONS[name]
  if (id) return <Editor name={name} spec={spec} id={id} opts={opts} />
  return <ContentList name={name} spec={spec} opts={opts} />
}

function ContentList({ name, spec, opts }: { name: string; spec: Spec; opts: Options }) {
  const { data, error, loading } = useLoad(() => api<{ items: Item[] }>(`/admin/${name}`), [name])
  const [status, setStatus] = useState('')
  const hasStatus = spec.inputs.some((i) => i.k === 'status')
  const rows = (data?.items ?? []).filter((r) => !status || r.status === status)
  return (
    <div>
      <Head title={spec.title} sub={spec.sub}><a class="btn btn--dark btn--sm" href={`#${name}/new`}>Add {spec.one === 'opportunity' ? 'an' : 'a'} {spec.one}</a></Head>
      {hasStatus && <div class="atools"><Filters label="Status" value={status} onChange={setStatus} options={[['', 'All'], ['published', 'Published'], ['draft', 'Drafts']]} /></div>}
      {error && <Msg kind="err">{error}</Msg>}
      {loading && !data && <Loading />}
      {data && <Table rows={rows} href={(r) => `#${name}/${r.id}`} cols={spec.cols(opts)} empty={`No ${spec.title.toLowerCase()} yet.`} />}
    </div>
  )
}

function Editor({ name, spec, id, opts }: { name: string; spec: Spec; id: string; opts: Options }) {
  const isNew = id === 'new'
  const { data, error, loading, reload } = useLoad(() => (isNew ? Promise.resolve(null) : api<Item>(`/admin/${name}/${id}`)), [name, id])
  const form = useRef<HTMLFormElement>(null)
  const { busy, msg, errors, run } = useSend()
  const del = useSend()
  const [removeFile, setRemoveFile] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  useFocusInvalid(errors, form)
  if (!isNew && loading && !data) return <Loading />
  if (error) return <Msg kind="err">{error}</Msg>
  const item: Record<string, any> = data ?? spec.blank
  const v = (k: string) => (item[k] == null ? '' : String(item[k]))
  const link = data && spec.link?.(data)

  const submit = (e: Event) => {
    e.preventDefault()
    const fd = new FormData(form.current!)
    if (spec.fileField) {
      const f = fd.get(spec.fileField)
      if (f instanceof File && !f.size) fd.delete(spec.fileField)
      if (removeFile) fd.set(`remove_${spec.fileField}`, 'true')
    }
    for (const i of spec.inputs) if (i.type === 'check') fd.set(i.k, (form.current!.elements.namedItem(i.k) as HTMLInputElement).checked ? 'true' : 'false')
    if (isNew) run(() => api<{ id: number }>(`/admin/${name}`, { form: fd })).then((r) => r && go(`${name}/${r.id}`))
    else run(() => api(`/admin/${name}/${id}`, { method: 'PUT', form: fd }), 'Saved.').then((r) => { if (r) { setRemoveFile(false); reload() } })
  }
  const remove = () => {
    if (!confirm(`Delete “${item.title}” for good?`)) return
    del.run(() => api(`/admin/${name}/${id}`, { method: 'DELETE' })).then((r) => r && go(name))
  }
  const file: FileRef | null | undefined = data?.file

  return (
    <div>
      <Head back={`#${name}`} title={isNew ? `A new ${spec.one}` : item.title} sub={!isNew && item.updated_at ? `Last saved ${day(String(item.updated_at).slice(0, 10))}` : undefined}>
        {item.status && !isNew && <Badge v={item.status} />}
        {link && <a class="btn btn--ghost btn--sm" href={link} target="_blank" rel="noopener">See it on the site ↗</a>}
      </Head>
      <form ref={form} class="form abox editor" onSubmit={submit} noValidate>
        {spec.inputs.map((i) => {
          if (i.type === 'select') return <Select label={i.label} name={i.k} options={i.options(opts)} defaultValue={v(i.k)} errors={errors} required={i.req} empty={i.req ? 'Choose…' : undefined} />
          if (i.type === 'check') return <label class="check full"><input type="checkbox" name={i.k} defaultChecked={!!item[i.k]} /><span>{i.label}</span></label>
          if (i.type === 'area') return <Area label={i.label} name={i.k} defaultValue={v(i.k)} maxLength={i.max} rows={i.rows ?? 3} errors={errors} hint={i.hint} optional={!i.req} />
          if (i.type === 'markdown') {
            return (
              <div class="full md">
                <Area label={i.label} name={i.k} defaultValue={v(i.k)} maxLength={i.max} rows={i.rows ?? 8} errors={errors} hint={i.hint} optional={!i.req} />
                <Btn small kind="plain" onClick={() => setPreview(preview === null ? String(new FormData(form.current!).get(i.k) ?? '') : null)}>{preview === null ? 'Preview the text' : 'Close the preview'}</Btn>
                {preview !== null && <div class="prose md__preview" dangerouslySetInnerHTML={{ __html: markdown(preview) || '<p><em>Nothing written yet.</em></p>' }} />}
              </div>
            )
          }
          if (i.type === 'file') {
            return (
              <div class="field full">
                <span>{i.label}<b> (optional)</b></span>
                {file && !removeFile && (
                  <p class="editor__file">
                    {/^image\//.test(String((file as { mime?: string }).mime ?? '')) || /\.(png|jpe?g|webp)$/i.test(file.name) ? <img src={file.url} alt="" /> : null}
                    <a href={file.url} target="_blank" rel="noopener">{file.name}</a> · {bytes(file.size)}
                    <Btn small kind="plain" onClick={() => setRemoveFile(true)}>Remove</Btn>
                  </p>
                )}
                {removeFile && <p class="editor__file">Removed when you save. <Btn small kind="plain" onClick={() => setRemoveFile(false)}>Keep it</Btn></p>}
                <input type="file" name={i.k} accept={i.accept} aria-invalid={errors[i.k] ? 'true' : undefined} />
                <span class={errors[i.k] ? 'err' : 'hint'}>{errors[i.k] || (file ? `Choose a file to replace it. ${i.hint}` : i.hint)}</span>
              </div>
            )
          }
          const t = i as Extract<Input, { type: 'text' | 'url' | 'date' | 'number' | 'month' }>
          return <Field label={t.label} name={t.k} type={t.type === 'month' ? 'text' : t.type} defaultValue={v(t.k)} maxLength={t.max}
            required={t.req} errors={errors} hint={t.hint} placeholder={t.placeholder} optional={!t.req} full={t.full} inputMode={t.type === 'number' ? 'numeric' : t.type === 'url' ? 'url' : undefined} />
        })}
        <div class="form__end full">
          <Btn type="submit" busy={busy}>{isNew ? `Add the ${spec.one}` : 'Save'}</Btn>
          {!isNew && <Btn kind="plain" busy={del.busy} onClick={remove}>Delete</Btn>}
          <Msg kind={(msg ?? del.msg)?.kind ?? 'info'}>{(msg ?? del.msg)?.text}</Msg>
        </div>
      </form>
    </div>
  )
}
