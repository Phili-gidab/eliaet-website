/* The Secretariat's back office (/admin): approvals, the forms' inbox, members and their people, and what ELIA
   publishes. One page; the part shown follows the address (#inquiries/12), so the links in the team's e-mails open
   the right item. Secretariat accounts only (the server checks every request). */
import { useEffect, useState } from 'preact/hooks'
import { api, session, loginUrl, type User } from '../api'
import { Loading, Msg, useLoad } from '../ui'
import { SignOut } from '../Dashboard'
import { useRoute } from './kit'
import { Overview } from './Overview'
import { Inquiries } from './Inquiries'
import { Applications, AccessRequests, Changes } from './Approvals'
import { Companies, People } from './Members'
import { Content, COLLECTIONS } from './Content'
import { Subscribers } from './Subscribers'

export type Options = {
  categories: Record<string, string>; sizes: Record<string, string>; regions: Record<string, string>; exportStatus: Record<string, string>
  inquiries: Record<string, { label: string; team: string }>; teams: Record<string, string>; postCategories: Record<string, string>
  publicationTypes: string[]; noticeKinds: Record<string, string>; opportunityKinds: Record<string, string>
}
export type OverviewData = {
  applications: number; access: number; changes: number; inquiries: number; members: number; users: number; subscribers: number; duesDue: number
  recent: { action: string; subject: string; subject_id: number | null; detail: string | null; created_at: string; who: string | null }[]
  options: Options; usersPerCompany: number
}

const NAV: { group: string; items: [key: string, label: string, count?: keyof OverviewData][] }[] = [
  { group: '', items: [['overview', 'Overview']] },
  { group: 'To answer', items: [['inquiries', 'Inbox', 'inquiries'], ['applications', 'Applications', 'applications'], ['access', 'Access requests', 'access'], ['changes', 'Profile changes', 'changes']] },
  { group: 'Members', items: [['companies', 'Member companies'], ['people', 'People and accounts']] },
  { group: 'Website', items: [['posts', 'News'], ['events', 'Events'], ['publications', 'Publications']] },
  { group: 'For members', items: [['notices', 'Notices'], ['opportunities', 'Opportunities']] },
  { group: 'Newsletter', items: [['subscribers', 'Subscribers']] },
]

export function Admin() {
  const [me, setMe] = useState<User | null | undefined>(undefined)
  const route = useRoute()
  const ov = useLoad(() => api<OverviewData>('/admin/overview'), [me?.id, route.section, route.id])
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => {
    session().then((u) => {
      if (!u) return location.assign(loginUrl('/admin' + location.hash))
      setMe(u)
    }).catch(() => setMe(null))
  }, [])
  useEffect(() => setNavOpen(false), [route.section, route.id])

  if (me === undefined) return <Loading />
  if (!me) return <Msg kind="err">The back office could not be reached. Please reload the page.</Msg>
  if (me.role !== 'secretariat') {
    return (
      <div class="aw">
        <Msg kind="err">The back office is for the ELIA Secretariat. You are signed in as {me.name}{me.company ? `, ${me.company.name}` : ''}.</Msg>
        <p class="row"><a class="btn btn--dark" href="/members/dashboard">My dashboard</a></p>
      </div>
    )
  }
  const opts = ov.data?.options
  const s = route.section
  const known = NAV.some((g) => g.items.some(([k]) => k === s))

  return (
    <div class={`admin${navOpen ? ' nav-open' : ''}`}>
      <aside class="anav" aria-label="Back office">
        <div class="anav__me">
          <p class="anav__name">{me.name}</p>
          <p class="anav__role">ELIA Secretariat</p>
        </div>
        {NAV.map((g) => (
          <div class="anav__group">
            {g.group && <p class="anav__g">{g.group}</p>}
            <ul role="list">
              {g.items.map(([k, l, c]) => {
                const n = c && ov.data ? Number(ov.data[c]) : 0
                return <li><a href={`#${k}`} aria-current={s === k ? 'page' : undefined}>{l}{n > 0 && <span class="anav__n" aria-label={`${n} to do`}>{n}</span>}</a></li>
              })}
            </ul>
          </div>
        ))}
        <div class="anav__end">
          <a href="/members/directory">Members directory</a>
          <a href="/" target="_blank" rel="noopener">The website ↗</a>
          <SignOut />
        </div>
      </aside>
      <button class="anav__toggle btn btn--ghost btn--sm" type="button" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>{navOpen ? 'Close the menu' : 'Menu'}</button>
      <div class="amain" id="amain">
        {!opts && ov.loading && <Loading />}
        {ov.error && <Msg kind="err">{ov.error}</Msg>}
        {opts && (
          <>
            {(s === 'overview' || !known) && <Overview data={ov.data!} />}
            {s === 'inquiries' && <Inquiries id={route.id} opts={opts} />}
            {s === 'applications' && <Applications id={route.id} opts={opts} />}
            {s === 'access' && <AccessRequests id={route.id} />}
            {s === 'changes' && <Changes id={route.id} />}
            {s === 'companies' && <Companies id={route.id} opts={opts} perCompany={ov.data!.usersPerCompany} query={route.query} />}
            {s === 'people' && <People id={route.id} query={route.query} me={me} />}
            {s in COLLECTIONS && <Content key={s} name={s as keyof typeof COLLECTIONS} id={route.id} opts={opts} />}
            {s === 'subscribers' && <Subscribers />}
          </>
        )}
      </div>
    </div>
  )
}
