/* The back office's first page: a greeting, what is waiting for an answer (each a way in), the association in four
   numbers, and what has happened lately, as a timeline. */
import { when, type User } from '../api'
import { Icon } from '../ui'
import { Head, AIcon } from './kit'
import type { OverviewData } from './Admin'

const LINK: Record<string, string> = {
  application: 'applications', company: 'companies', user: 'people', inquiry: 'inquiries', access_request: 'access',
  posts: 'posts', events: 'events', publications: 'publications', notices: 'notices', opportunities: 'opportunities',
}

export function Overview({ data, me }: { data: OverviewData; me: User }) {
  const todo: [string, number, string, string][] = [
    ['inquiries', data.inquiries, 'New messages', 'From the forms on the website'],
    ['applications', data.applications, 'Membership applications', 'Companies asking to join'],
    ['access', data.access, 'Access requests', 'People of member companies'],
    ['changes', data.changes, 'Profile changes', 'Waiting before they show'],
  ]
  const facts: [string, number, string][] = [
    ['companies', data.members, 'Active member companies'],
    ['people', data.users, 'Member accounts'],
    ['companies?dues=due', data.duesDue, 'Dues due or not on file'],
    ['subscribers', data.subscribers, 'Newsletter subscribers'],
  ]
  // in Addis Ababa's time
  const hour = new Date(Date.now() + 3 * 3600000).getUTCHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const waiting = todo.reduce((n, t) => n + t[1], 0)
  const today = new Date(Date.now() + 3 * 3600000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <div class="ovw">
      <Head title={<>{greet}, <em>{me.name.split(/\s+/)[0]}</em>.</>}
        sub={<>{today}. {waiting ? <>{waiting === 1 ? 'One thing is' : `${waiting} things are`} waiting for an answer.</> : 'Nothing is waiting for an answer.'}</>} />

      <h2 class="sr-only">To answer</h2>
      <ul class="ov" role="list">
        {todo.map(([k, n, t, s]) => (
          <li>
            <a class={`ov__card${n ? ' is-due' : ''}`} href={`#${k}`}>
              <span class="ov__top"><span class="ov__i">{AIcon[k]}</span>{n > 0 && <span class="ov__go">Open {Icon.arrow}</span>}</span>
              <span class="ov__n figure-num">{n}</span>
              <span class="ov__t">{t}</span>
              <span class="ov__s">{n ? s : 'Nothing waiting'}</span>
            </a>
          </li>
        ))}
      </ul>

      <h2 class="sr-only">The association</h2>
      <ul class="ovband" role="list">
        {facts.map(([k, n, t]) => (
          <li><a href={`#${k}`}><span class="ovband__n figure-num">{n}</span><span class="ovband__t">{t}</span></a></li>
        ))}
      </ul>

      <section class="abox ovlog">
        <h2 class="abox__h">Recent activity</h2>
        {data.recent.length ? (
          <ol class="log" role="list">
            {data.recent.map((r) => {
              const to = LINK[r.subject]
              const what = `${r.action.charAt(0).toUpperCase()}${r.action.slice(1)}${r.detail ? `: ${r.detail}` : ''}`
              return (
                <li>
                  <span class="log__dot" aria-hidden="true" />
                  <span class="log__what">{to && r.subject_id ? <a href={`#${to}/${r.subject_id}`}>{what}</a> : what}</span>
                  <span class="log__who">{r.who ?? 'Someone'} · {when(r.created_at)}</span>
                </li>
              )
            })}
          </ol>
        ) : <p class="atable__empty">Nothing yet.</p>}
      </section>
    </div>
  )
}
