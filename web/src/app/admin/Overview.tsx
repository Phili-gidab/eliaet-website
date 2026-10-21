import { when } from '../api'
import { Head } from './kit'
import type { OverviewData } from './Admin'

const LINK: Record<string, string> = {
  application: 'applications', company: 'companies', user: 'people', inquiry: 'inquiries', access_request: 'access',
  posts: 'posts', events: 'events', publications: 'publications', notices: 'notices', opportunities: 'opportunities',
}

export function Overview({ data }: { data: OverviewData }) {
  const todo: [string, number, string, string][] = [
    ['inquiries', data.inquiries, 'New messages', 'From the forms on the website'],
    ['applications', data.applications, 'Membership applications', 'To review'],
    ['access', data.access, 'Access requests', 'People of member companies'],
    ['changes', data.changes, 'Profile changes', 'Waiting before they show'],
  ]
  const facts: [string, number, string][] = [
    ['companies', data.members, 'Active member companies'],
    ['people', data.users, 'Member accounts'],
    ['companies?dues=due', data.duesDue, 'Dues due or not on file'],
    ['subscribers', data.subscribers, 'Newsletter subscribers'],
  ]
  return (
    <div>
      <Head title="Overview" sub="What is waiting, and what has happened lately." />
      <ul class="ov" role="list">
        {todo.map(([k, n, t, s]) => (
          <li><a class={`ov__card${n ? ' is-due' : ''}`} href={`#${k}`}><span class="ov__n">{n}</span><span class="ov__t">{t}</span><span class="ov__s">{n ? s : 'Nothing waiting'}</span></a></li>
        ))}
      </ul>
      <ul class="ov ov--quiet" role="list">
        {facts.map(([k, n, t]) => <li><a class="ov__card" href={`#${k}`}><span class="ov__n">{n}</span><span class="ov__t">{t}</span></a></li>)}
      </ul>
      <section class="abox">
        <h2 class="abox__h">Recent activity</h2>
        {data.recent.length ? (
          <ul class="log" role="list">
            {data.recent.map((r) => {
              const to = LINK[r.subject]
              const what = `${r.action.charAt(0).toUpperCase()}${r.action.slice(1)}${r.detail ? `: ${r.detail}` : ''}`
              return (
                <li>
                  <span class="log__what">{to && r.subject_id ? <a href={`#${to}/${r.subject_id}`}>{what}</a> : what}</span>
                  <span class="log__who">{r.who ?? 'Someone'} · {when(r.created_at)}</span>
                </li>
              )
            })}
          </ul>
        ) : <p class="atable__empty">Nothing yet.</p>}
      </section>
    </div>
  )
}
