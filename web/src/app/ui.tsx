/* Small parts the members' area and the back office are built from: fields with their errors, status messages,
   buttons that say they are busy, a confirm step, empty states. Styles: styles/app.css. */
import type { ComponentChildren, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ButtonHTMLAttributes } from 'preact'
import { useEffect, useId, useState } from 'preact/hooks'
import { ApiError } from './api'

export type Errors = Record<string, string>

type FieldProps = {
  label: string
  name: string
  errors?: Errors
  hint?: ComponentChildren
  optional?: boolean
  full?: boolean
  class?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'label' | 'class'>

/** A labelled input; its error (from the server's answer) under it. */
export function Field({ label, name, errors, hint, optional, full, class: cls, ...rest }: FieldProps) {
  const err = errors?.[name]
  const id = `f-${name}-${useId()}`
  return (
    <label class={`field${full ? ' full' : ''}${cls ? ' ' + cls : ''}`}>
      <span>{label}{optional && <b> (optional)</b>}</span>
      <input name={name} id={id} aria-invalid={err ? 'true' : undefined} aria-describedby={err || hint ? `${id}-d` : undefined} {...rest} />
      {(err || hint) && <span class={err ? 'err' : 'hint'} id={`${id}-d`}>{err || hint}</span>}
    </label>
  )
}

type AreaProps = { label: string; name: string; errors?: Errors; hint?: ComponentChildren; optional?: boolean; full?: boolean } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'label'>
export function Area({ label, name, errors, hint, optional, full = true, ...rest }: AreaProps) {
  const err = errors?.[name]
  const id = `a-${name}-${useId()}`
  return (
    <label class={`field${full ? ' full' : ''}`}>
      <span>{label}{optional && <b> (optional)</b>}</span>
      <textarea name={name} id={id} aria-invalid={err ? 'true' : undefined} aria-describedby={err || hint ? `${id}-d` : undefined} {...rest} />
      {(err || hint) && <span class={err ? 'err' : 'hint'} id={`${id}-d`}>{err || hint}</span>}
    </label>
  )
}

type SelectProps = {
  label: string
  name: string
  options: [value: string, label: string][]
  errors?: Errors
  hint?: ComponentChildren
  optional?: boolean
  full?: boolean
  empty?: string
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'label'>
export function Select({ label, name, options, errors, hint, optional, full, empty, defaultValue, value, ...rest }: SelectProps) {
  const err = errors?.[name]
  const id = `s-${name}-${useId()}`
  // a <select> has no default value of its own: the option that starts selected carries it (left alone afterwards)
  const start = value === undefined ? String(defaultValue ?? '') : undefined
  return (
    <label class={`field${full ? ' full' : ''}`}>
      <span>{label}{optional && <b> (optional)</b>}</span>
      <select name={name} id={id} aria-invalid={err ? 'true' : undefined} aria-describedby={err || hint ? `${id}-d` : undefined} value={value} {...rest}>
        {empty !== undefined && <option value="" selected={start === ''}>{empty}</option>}
        {options.map(([v, l]) => <option value={v} selected={start !== undefined ? start === v : undefined}>{l}</option>)}
      </select>
      {(err || hint) && <span class={err ? 'err' : 'hint'} id={`${id}-d`}>{err || hint}</span>}
    </label>
  )
}

/** Boxes of one name (certifications, interests) */
export function Checks({ label, name, options, value = [], errors, full = true }: { label: string; name: string; options: [string, string][]; value?: string[]; errors?: Errors; full?: boolean }) {
  return (
    <fieldset class={`chips field${full ? ' full' : ''}`}>
      <legend>{label}</legend>
      {options.map(([v, l]) => (
        <label class="chip"><input type="checkbox" name={name} value={v} defaultChecked={value.includes(v)} /><span>{l}</span></label>
      ))}
      {errors?.[name] && <span class="err">{errors[name]}</span>}
    </fieldset>
  )
}

/** A status line: what happened, in words */
export function Msg({ kind = 'info', children, live = true }: { kind?: 'ok' | 'err' | 'info' | 'warn'; children: ComponentChildren; live?: boolean }) {
  if (!children) return null
  return <p class={`msg msg--${kind}`} role={kind === 'err' ? 'alert' : live ? 'status' : undefined}>{children}</p>
}

export function Btn({ busy, children, kind = 'dark', small, ...rest }: { busy?: boolean; kind?: 'dark' | 'ghost' | 'amber' | 'danger' | 'plain'; small?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = kind === 'plain' ? 'linkbtn' : `btn${kind === 'dark' ? ' btn--dark' : kind === 'ghost' ? ' btn--ghost' : kind === 'danger' ? ' btn--danger' : ''}${small ? ' btn--sm' : ''}`
  return (
    <button class={cls} disabled={busy || (rest.disabled as boolean)} aria-busy={busy ? 'true' : undefined} type="button" {...rest}>
      {children}{busy && <span class="spin" aria-hidden="true" />}
    </button>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <p class="loading" role="status"><span class="spin" aria-hidden="true" /> {label}</p>
}

export function Empty({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <div class="emptybox">
      <p class="emptybox__t">{title}</p>
      {children && <div class="emptybox__s">{children}</div>}
    </div>
  )
}

/** An error from the server as a message, and its fields as marks on the form. */
export function errorOf(e: unknown): { message: string; fields: Errors } {
  if (e instanceof ApiError) return { message: e.message, fields: e.fields }
  return { message: 'Something went wrong. Please try again.', fields: {} }
}

/** Runs a send: busy while it runs, its message and field errors after. */
export function useSend() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const run = async <T,>(fn: () => Promise<T>, ok?: string | ((r: T) => string)): Promise<T | undefined> => {
    setBusy(true); setMsg(null); setErrors({})
    try {
      const r = await fn()
      if (ok) setMsg({ kind: 'ok', text: typeof ok === 'function' ? ok(r) : ok })
      return r
    } catch (e) {
      const { message, fields } = errorOf(e)
      setMsg({ kind: 'err', text: message })
      setErrors(fields)
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { busy, msg, errors, run, setMsg, setErrors }
}

/** Data loaded once (and again when `deps` change), with its loading and error states */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    setLoading(true); setError(null)
    fn().then((d) => { if (live) setData(d) }).catch((e) => { if (live) setError(errorOf(e).message) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [...deps, tick])
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData }
}

/** Focuses the first field marked invalid after a refused send */
export function useFocusInvalid(errors: Errors, ref: { current: HTMLElement | null }) {
  useEffect(() => {
    if (!Object.keys(errors).length) return
    ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors])
}

export const initials = (name: string) => name.replace(/\b(PLC|S\.?C\.?|LTD|Ltd|Share Company|Private Limited Company)\b/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export const Icon = {
  arrow: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>,
  back: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12H5m6-6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>,
  out: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>,
  down: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12m-5-5 5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>,
  search: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>,
  grid: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>,
  list: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>,
  lock: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>,
  pin: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>,
  file: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zm0 0v4h4M9 13h6M9 17h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>,
  x: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.7" /></svg>,
  check: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>,
}
