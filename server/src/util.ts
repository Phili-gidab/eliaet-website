/* Small helpers shared by the routes: errors that become JSON answers, checking what was sent (zod), names for
   addresses, spreadsheets. */
import { isIP } from 'node:net'
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

/** Where every visitor counts as one: the web server in front of the app says nothing about who the visitor is. */
export const SHARED = 'shared'
/** this machine, or a private network: never a visitor's own address on the internet */
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|::$|f[cd][0-9a-f]{0,2}:|fe[89ab][0-9a-f]?:|::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.))/i
let warned = false

/** The visitor's address as the web server in front of the app reports it, whatever the settings (the deploy
    script's check reads it). On cPanel the app sits behind that web server (Apache or LiteSpeed, through Passenger),
    so the connection itself comes from this machine or a private address: then the visitor is the address the web
    server added at the end of X-Forwarded-For (the entries before it are the visitor's own word, never trusted), if
    it is one on the internet. Nothing usable there: SHARED. */
export function addressSeen(req: Request): string {
  const peer = req.socket.remoteAddress ?? ''
  if (peer && !PRIVATE.test(peer)) return peer                       // a visitor connected straight to the app
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const last = fwd[fwd.length - 1]
  if (last && isIP(last) && !PRIVATE.test(last)) return last
  if (!warned && process.env.NODE_ENV === 'production' && peer) {
    warned = true
    console.warn('[server] the web server sends no visitor address (X-Forwarded-For): the rate limits count all visitors together')
  }
  return SHARED
}

/** The visitor's address, for the rate limits: what the web server reports, unless the deploy script found that it
    cannot be relied on here (CLIENT_IP=shared in the data folder's .env): then every visitor counts as one, SHARED,
    and the limits are set for that (security.ts visitor()). */
export function ipOf(req: Request): string {
  return process.env.CLIENT_IP === 'shared' ? SHARED : addressSeen(req)
}

/** A page number from the address: a whole number from 1 to 10 000 (anything else is page 1). */
export const pageNumber = (v: unknown) => {
  const n = Math.floor(Number(v))
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, 10_000) : 1
}

/** A path on this site to send someone to: one leading slash, never two or a backslash (which a browser would
    read as another site's address). */
export const sameSitePath = (p: string) => '/' + p.replace(/^[/\\]+/, '')
