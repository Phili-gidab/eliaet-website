/* Signing in, a forgotten password, setting a password from an e-mailed link, and asking for access: the content
   document's "Member Login" (e-mail, password; forgot password; request access). */
import { useEffect, useRef, useState } from 'preact/hooks'
import { api, session, safeNext, setCsrf, type User } from './api'
import { Field, Area, Msg, Btn, Loading, useSend, useFocusInvalid, Icon } from './ui'
import { ready, solvePow } from '../lib/pow'

const home = (u: User) => (u.role === 'secretariat' ? '/admin' : '/members/directory')

/** Sign in. `compact`: the card on the Members page (no heading of its own). */
export function Login({ compact = false }: { compact?: boolean }) {
  const [me, setMe] = useState<User | null | undefined>(undefined)
  const { busy, msg, errors, run } = useSend()
  const form = useRef<HTMLFormElement>(null)
  useFocusInvalid(errors, form)
  const next = safeNext(new URLSearchParams(location.search).get('next'), '')

  useEffect(() => { session().then(setMe).catch(() => setMe(null)) }, [])

  if (me === undefined) return <Loading />
  if (me) {
    return (
      <div class="auth__in">
        <p class="auth__who">Signed in as <b>{me.name}</b>{me.company ? <>, {me.company.name}</> : me.role === 'secretariat' ? ', ELIA Secretariat' : ''}.</p>
        <div class="row">
          <a class="btn btn--dark" href={next || home(me)}>{me.role === 'secretariat' ? 'Open the back office' : 'Open the directory'} {Icon.arrow}</a>
          {me.role === 'member' && <a class="btn btn--ghost" href="/members/dashboard">My dashboard</a>}
        </div>
      </div>
    )
  }

  const submit = (e: Event) => {
    e.preventDefault()
    const f = new FormData(form.current!)
    run(async () => {
      const r = await api<{ user: User; csrf: string }>('/auth/login', { body: { email: f.get('email'), password: f.get('password') }, redirect401: false })
      setCsrf(r.csrf)
      location.assign(next || home(r.user))
    })
  }

  return (
    <form ref={form} class="form auth__form" onSubmit={submit} noValidate aria-label={compact ? 'Member login' : undefined}>
      <Field label="E-mail address" name="email" type="email" inputMode="email" autoComplete="username" required maxLength={160} spellcheck={false} errors={errors} full />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required maxLength={200} errors={errors} full />
      <div class="form__end full">
        <Btn type="submit" busy={busy}>Sign in {Icon.arrow}</Btn>
        <a class="auth__link" href="/members/forgot">Forgot password?</a>
      </div>
      <Msg kind="err">{msg?.kind === 'err' ? msg.text : ''}</Msg>
      <p class="auth__alt full">No account for your company yet? <a href="/members/request-access">Request access</a></p>
    </form>
  )
}

export function Forgot() {
  const { busy, msg, errors, run } = useSend()
  const [sent, setSent] = useState<string | null>(null)
  const form = useRef<HTMLFormElement>(null)
  useFocusInvalid(errors, form)
  const submit = (e: Event) => {
    e.preventDefault()
    const email = String(new FormData(form.current!).get('email') ?? '')
    run(async () => {
      await api('/auth/forgot', { body: { email, pow: await solvePow() }, redirect401: false })
      setSent(email)
    })
  }
  if (sent) {
    return (
      <div class="auth__in">
        <Msg kind="ok">If <b>{sent}</b> has an account, a link to choose a new password is on its way. It works for one hour.</Msg>
        <p class="auth__alt">Nothing after a few minutes? Look in the spam folder, or <a href="/contact?form=general&subject=Members%27%20area%20access#forms">write to the Secretariat</a>.</p>
        <p><a class="link" href="/members/login">{Icon.back} Back to sign in</a></p>
      </div>
    )
  }
  return (
    <form ref={form} class="form auth__form" onSubmit={submit} onFocusIn={() => ready()} noValidate>
      <p class="auth__lead full">Enter the e-mail address you sign in with. We will send you a link to choose a new password.</p>
      <Field label="E-mail address" name="email" type="email" inputMode="email" autoComplete="username" required maxLength={160} spellcheck={false} errors={errors} full />
      <div class="form__end full">
        <Btn type="submit" busy={busy}>Send the link {Icon.arrow}</Btn>
        <a class="auth__link" href="/members/login">Back to sign in</a>
      </div>
      <Msg kind="err">{msg?.kind === 'err' ? msg.text : ''}</Msg>
    </form>
  )
}

/** The e-mailed link: /members/password?token=… (a new account's first password, or a reset) */
export function SetPassword() {
  // read once: the address bar loses the token right after (below), and every later render must still have it
  const [token] = useState(() => new URLSearchParams(location.search).get('token') ?? '')
  const [info, setInfo] = useState<{ ok: boolean; kind?: string; name?: string; email?: string; error?: string } | null>(null)
  const [pw, setPw] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const { busy, msg, errors, run } = useSend()
  const form = useRef<HTMLFormElement>(null)
  useFocusInvalid(errors, form)

  useEffect(() => {
    if (!token) { setInfo({ ok: false, error: 'This page needs the link from your e-mail. Ask for a new one below.' }); return }
    api<{ ok: boolean; kind?: string; name?: string; email?: string; error?: string }>(`/auth/token?token=${encodeURIComponent(token)}`, { redirect401: false })
      .then(setInfo).catch(() => setInfo({ ok: false, error: 'This link could not be checked. Please try again.' }))
    // the token stays out of the address bar's history and out of any later Referer
    history.replaceState(null, '', location.pathname)
  }, [])

  if (!info) return <Loading label="Checking the link…" />
  if (!info.ok) {
    return (
      <div class="auth__in">
        <Msg kind="err">{info.error}</Msg>
        <div class="row"><a class="btn btn--dark" href="/members/forgot">Ask for a new link {Icon.arrow}</a><a class="btn btn--ghost" href="/members/login">Sign in</a></div>
      </div>
    )
  }
  const strength = pw.length === 0 ? '' : pw.length < 10 ? 'At least 10 characters' : pw.length < 14 ? 'Good' : 'Strong'
  const submit = (e: Event) => {
    e.preventDefault()
    const f = new FormData(form.current!)
    if (f.get('password') !== f.get('again')) {
      setMismatch(true)
      form.current!.querySelector<HTMLInputElement>('[name="again"]')?.focus()
      return
    }
    setMismatch(false)
    run(async () => {
      const r = await api<{ user: User; csrf: string }>('/auth/password', { body: { token, password: f.get('password') }, redirect401: false })
      setCsrf(r.csrf)
      location.assign(home(r.user))
    })
  }
  return (
    <form ref={form} class="form auth__form" onSubmit={submit} noValidate>
      <p class="auth__lead full">{info.kind === 'set_password' ? <>Welcome, {info.name}. Choose a password for your account.</> : <>Choose a new password, {info.name}.</>}</p>
      <input type="email" name="username" autoComplete="username" value={info.email} hidden readOnly />
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} errors={errors} full
        value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} hint={strength || 'At least 10 characters. A few words make a strong one.'} />
      <Field label="The same password again" name="again" type="password" autoComplete="new-password" required maxLength={200} full
        errors={mismatch ? { again: 'The two passwords are not the same' } : undefined} />
      <div class="form__end full">
        <Btn type="submit" busy={busy}>Save and sign in {Icon.arrow}</Btn>
      </div>
      <Msg kind="err">{msg?.kind === 'err' ? msg.text : ''}</Msg>
    </form>
  )
}

export function RequestAccess() {
  const { busy, msg, errors, run } = useSend()
  const [done, setDone] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  useFocusInvalid(errors, form)
  const submit = (e: Event) => {
    e.preventDefault()
    const el = form.current!
    if (!el.checkValidity()) {
      const bad = el.querySelector<HTMLElement>(':invalid:not(fieldset)')
      bad?.setAttribute('aria-invalid', 'true'); bad?.focus()
      return
    }
    const f = Object.fromEntries(new FormData(el).entries())
    run(async () => {
      await api('/auth/request-access', { body: { ...f, pow: await solvePow() }, redirect401: false })
      setDone(true)
    })
  }
  if (done) {
    return (
      <div class="auth__in">
        <Msg kind="ok">Thank you. The ELIA Secretariat will check your request and e-mail you a link to set your password once it is approved.</Msg>
        <p><a class="link" href="/members">{Icon.back} Back to the Members page</a></p>
      </div>
    )
  }
  return (
    <form ref={form} class="form auth__form" onSubmit={submit} onFocusIn={() => ready()} noValidate>
      <p class="auth__lead full">For people of ELIA member companies. Each member company may register up to three users; the Secretariat approves each one.</p>
      <Field label="Member company" name="companyName" autoComplete="organization" required maxLength={200} errors={errors} full hint="As registered with ELIA" />
      <Field label="Your name" name="name" autoComplete="name" required maxLength={120} errors={errors} />
      <Field label="Position" name="position" autoComplete="organization-title" maxLength={120} errors={errors} optional />
      <Field label="E-mail address" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={160} spellcheck={false} errors={errors} />
      <Field label="Phone" name="phone" type="tel" autoComplete="tel" maxLength={40} errors={errors} optional />
      <Area label="Message" name="message" maxLength={2000} rows={3} errors={errors} optional />
      <input class="hp" name="website_url" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div class="form__end full">
        <Btn type="submit" busy={busy}>Request access {Icon.arrow}</Btn>
        <a class="auth__link" href="/members/login">I have an account</a>
      </div>
      <Msg kind="err">{msg?.kind === 'err' ? msg.text : ''}</Msg>
    </form>
  )
}
