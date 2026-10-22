/* The members' area and the back office talk to the server through this: JSON in and out, the session's CSRF token
   sent back on every change, a signed-out visitor sent to the sign-in page (and back afterwards). */

export type Role = 'member' | 'secretariat'
export interface User {
  id: number
  email: string
  name: string
  position: string | null
  phone: string | null
  role: Role
  company: { id: number; name: string; slug: string; status: string } | null
}

let csrf: string | null = null

export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message)
  }
}

/** Who is signed in (null if nobody), and the token changes need. */
export async function session(): Promise<User | null> {
  const r = await fetch('/api/auth/session', { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' })
  const d = await r.json().catch(() => ({}))
  csrf = d.csrf ?? null
  return d.user ?? null
}

export const setCsrf = (t: string | null) => { csrf = t }

/** Where a signed-out visitor goes to sign in, coming back here afterwards. */
export const loginUrl = (back = location.pathname + location.search + location.hash) => `/members/login?next=${encodeURIComponent(back)}`

/** Only an address on this site is a place to go back to after signing in. Read the way the browser would read it
    (which drops tabs and line breaks and turns a backslash into a slash), so a crafted one cannot lead elsewhere. */
export function safeNext(v: string | null | undefined, fallback: string): string {
  if (!v || !v.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(v)) return fallback
  try {
    const u = new URL(v, location.origin)
    if (u.origin !== location.origin || u.pathname.startsWith('/api/')) return fallback
    return u.pathname + u.search + u.hash
  } catch {
    return fallback
  }
}

export async function api<T = Record<string, unknown>>(
  path: string,
  o: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; form?: FormData; redirect401?: boolean } = {},
): Promise<T> {
  const method = o.method ?? (o.body !== undefined || o.form ? 'POST' : 'GET')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET' && csrf) headers['X-CSRF'] = csrf
  let body: BodyInit | undefined
  if (o.form) body = o.form
  else if (o.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.body) }
  let r: Response
  try {
    r = await fetch('/api' + path, { method, headers, body, credentials: 'same-origin', cache: 'no-store' })
  } catch {
    throw new ApiError(0, 'No connection. Please check it and try again.')
  }
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && o.redirect401 !== false) {
    location.assign(loginUrl())
    throw new ApiError(401, 'Please sign in.')
  }
  if (!r.ok) throw new ApiError(r.status, d.error || 'Something went wrong. Please try again.', d.fields || {})
  if (typeof d.csrf === 'string') csrf = d.csrf
  return d as T
}

/** A form's fields as an object; boxes of one name (interests, certifications) as a list. */
export function formObject(form: HTMLFormElement): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const fd = new FormData(form)
  for (const [k, v] of fd.entries()) {
    if (typeof v !== 'string') continue
    const many = form.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(k)}"]`).length > 1
    out[k] = k in out ? [out[k]].flat().concat(v) : many ? [v] : v
  }
  form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((c) => {
    const many = form.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(c.name)}"]`).length > 1
    if (!(c.name in out)) out[c.name] = many ? [] : 'false'
  })
  return out
}

/* dates as people read them */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function day(iso?: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso)
  if (!m) return iso
  return m[3] ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : `${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}
export function when(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Addis_Ababa' })
  const ds = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Addis_Ababa' })
  return `${day(ds)}, ${t}`
}
export const bytes = (n?: number | null) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`)
