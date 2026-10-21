/* Small helpers shared by the routes: errors that become JSON answers, checking what was sent (zod), names for
   addresses, spreadsheets. */
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { z } from 'zod'

/** An answer other than 200, with a message for people (and the fields to look at again, for a form). */
export class HttpError extends Error {
  constructor(public status: number, message: string, public fields?: Record<string, string>) {
    super(message)
  }
}
export const notFound = (what = 'Not found') => new HttpError(404, what)
export const forbidden = (what = 'You do not have access to this.') => new HttpError(403, what)
export const bad = (what: string, fields?: Record<string, string>) => new HttpError(400, what, fields)

/** Lets a route be async: a thrown error goes to the error handler. */
export const wrap = (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }

/** Checks a body against a schema; a mismatch is a 422 with one message per field. */
export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data ?? {})
  if (r.success) return r.data
  const fields: Record<string, string> = {}
  for (const issue of r.error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message
  throw new HttpError(422, 'Please check the highlighted fields.', fields)
}

/* common field shapes */
export const str = (max: number) => z.string().trim().max(max, `At most ${max} characters`)
export const opt = (max: number) => z.preprocess((v) => (v == null ? '' : v), str(max))
export const req = (max: number) => str(max).min(1, 'Required')
export const email = z.string().trim().toLowerCase().max(160).pipe(z.email('Enter a valid e-mail address'))
export const optEmail = z.preprocess((v) => (v === '' || v == null ? undefined : v), email.optional())
export const intOrNull = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.number().int().min(min).max(max).nullable())
export const day = z.preprocess((v) => (v === '' || v == null ? null : v), z.iso.date('Pick a date').nullable())
export const url = z.preprocess(
  (v) => (v == null ? '' : typeof v === 'string' && v.trim() && !/^(https?:)?\/\//i.test(v.trim()) && !v.trim().startsWith('/') ? `https://${v.trim()}` : v),
  z.union([z.literal(''), z.string().trim().max(400).refine((s) => /^(https?:\/\/|\/)[^\s<>"']+$/i.test(s), 'Enter a web address')]),
)

/** "Ethio-Leather Industry PLC" -> "ethio-leather-industry-plc" */
export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item'
}

/** A spreadsheet that opens cleanly in Excel: UTF-8 with its mark, and no cell that starts a formula. */
export function csv(rows: Record<string, unknown>[], columns: [key: string, label: string][]): string {
  const cell = (v: unknown) => {
    let s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.map(([, l]) => cell(l)).join(',')]
  for (const r of rows) lines.push(columns.map(([k]) => cell(r[k])).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** Reads a CSV (as Excel saves it) into rows keyed by the header line. */
export function parseCsv(text: string): Record<string, string>[] {
  const s = text.replace(/^﻿/, '')
  // Excel saves with semicolons where the comma is the decimal mark: take whichever the header line uses
  const first = s.split(/\r?\n/, 1)[0] ?? ''
  const sep = first.includes(';') && !first.includes(',') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  const [head, ...body] = rows
  if (!head) return []
  const keys = head.map((h) => h.trim().toLowerCase())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

/** The client's address, as a short one-way code (kept for rate limits, never the address itself). */
/** The visitor's address, for the rate limits. Behind cPanel's Apache and Passenger the connection itself may come
    from this machine (or a local socket): then the address the nearest proxy added to X-Forwarded-For is the one
    (the earlier entries are the visitor's own word, so they are not trusted). */
export function ipOf(req: Request): string {
  const direct = String(req.ip ?? req.socket.remoteAddress ?? '')
  if (direct && !/^(::1$|127\.|::ffff:127\.)/.test(direct)) return direct
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return fwd[fwd.length - 1] || String(req.headers['x-real-ip'] ?? '').trim() || direct || 'unknown'
}
