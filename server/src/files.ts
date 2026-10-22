/* Uploaded files: kept in the data folder (never where the web server could hand them out by itself), each under a
   random name, and served through /files/<key>/<name> only to those allowed to see it:
   - public: anyone (news pictures, public publications);
   - members: signed-in members and the Secretariat (members-only documents, member logos and photos);
   - private: the Secretariat, and the person who uploaded it (trade licences, application papers).
   What a file is comes from its first bytes, not its name. */
import fs from 'node:fs'
import path from 'node:path'
import { Router, type Request } from 'express'
import multer from 'multer'
import { config } from './config.js'
import { one, run, now } from './db.js'
import { randomToken } from './security.js'
import { HttpError, notFound, wrap } from './util.js'

export type Access = 'public' | 'members' | 'private'
export type Kind = 'image' | 'doc' | 'licence'

const TYPES: Record<string, { ext: string; mime: string; kinds: Kind[] }> = {
  png: { ext: 'png', mime: 'image/png', kinds: ['image', 'licence'] },
  jpg: { ext: 'jpg', mime: 'image/jpeg', kinds: ['image', 'licence'] },
  webp: { ext: 'webp', mime: 'image/webp', kinds: ['image', 'licence'] },
  pdf: { ext: 'pdf', mime: 'application/pdf', kinds: ['doc', 'licence'] },
  docx: { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kinds: ['doc'] },
  xlsx: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kinds: ['doc'] },
  pptx: { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kinds: ['doc'] },
}
export const MAX_MB: Record<Kind, number> = { image: 4, doc: 25, licence: 8 }

function sniff(buf: Buffer, name: string): (typeof TYPES)[string] | null {
  const s = (n: number) => buf.subarray(0, n)
  if (s(8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return TYPES.png
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return TYPES.jpg
  if (s(4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return TYPES.webp
  if (s(5).toString('latin1') === '%PDF-') return TYPES.pdf
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    // an Office file is a zip; its name says which (the zip's own listing would say the same)
    const ext = path.extname(name).toLowerCase().slice(1)
    if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') return TYPES[ext]
  }
  return null
}

const cleanName = (name: string, ext: string) =>
  (path.basename(name, path.extname(name)).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file') + '.' + ext

function fileDir() {
  const d = path.join(config.dataDir, 'files')
  fs.mkdirSync(d, { recursive: true, mode: 0o700 })
  return d
}
const pathOf = (key: string) => path.join(fileDir(), key.slice(0, 2), key)

/** Keeps an uploaded file (from multer's memory storage); returns its id. */
export function store(f: Express.Multer.File, kind: Kind, access: Access, ownerId: number | null, field = 'file'): number {
  const t = sniff(f.buffer, f.originalname)
  if (!t || !t.kinds.includes(kind)) {
    const want = kind === 'image' ? 'a PNG, JPG or WebP picture' : kind === 'licence' ? 'a PDF, PNG, JPG or WebP file' : 'a PDF, Word, Excel or PowerPoint file'
    throw new HttpError(422, `Please choose ${want}.`, { [field]: `Use ${want}` })
  }
  if (f.size > MAX_MB[kind] * 1024 * 1024) throw new HttpError(413, `The file must be under ${MAX_MB[kind]} MB.`, { [field]: `Max ${MAX_MB[kind]} MB` })
  const key = randomToken(18)
  const p = pathOf(key)
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 })
  fs.writeFileSync(p, f.buffer, { mode: 0o600 })
  return run('INSERT INTO files (key, name, mime, size, access, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    key, cleanName(f.originalname, t.ext), t.mime, f.size, access, ownerId, now()).id
}

/** Adds a file that ships with the site (seeding): copies it into the store. */
export function storeLocal(file: string, access: Access, name = path.basename(file)): number {
  const buf = fs.readFileSync(file)
  const t = sniff(buf, name)
  if (!t) throw new Error(`not a known file type: ${file}`)
  const key = randomToken(18)
  const p = pathOf(key)
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 })
  fs.writeFileSync(p, buf, { mode: 0o600 })
  return run('INSERT INTO files (key, name, mime, size, access, owner_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    key, cleanName(name, t.ext), t.mime, buf.length, access, null, now()).id
}

export function setAccess(id: number | null | undefined, access: Access) {
  if (id) run('UPDATE files SET access = ? WHERE id = ?', access, id)
}

export function removeFile(id: number | null | undefined) {
  if (!id) return
  const f = one<{ key: string }>('SELECT key FROM files WHERE id = ?', id)
  if (!f) return
  run('DELETE FROM files WHERE id = ?', id)
  fs.rm(pathOf(f.key), { force: true }, () => undefined)
}

export interface FileRef { id: number; url: string; name: string; mime: string; size: number; access: Access }
export function fileRef(id: number | null | undefined): FileRef | null {
  if (!id) return null
  const f = one('SELECT id, key, name, mime, size, access FROM files WHERE id = ?', id)
  return f ? { id: f.id, url: `/files/${f.key}/${encodeURIComponent(f.name)}`, name: f.name, mime: f.mime, size: f.size, access: f.access } : null
}
export const fileUrl = (id: number | null | undefined) => fileRef(id)?.url ?? null

/** multer, keeping uploads in memory (they are checked before anything is written). This one is for the back office
    (documents up to 25 MB, a news post's text); the public form and the members' area have tighter ones of their own. */
export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 26 * 1024 * 1024, files: 8, fields: 60, fieldSize: 256 * 1024 } })

/* ---- serving ---- */

export const files = Router()

/** Members-only files are for the Secretariat and the people of a member company whose membership is active (as
    the directory is), for whoever uploaded the file, and for the people of the company whose logo or photo it is. */
function memberMaySee(u: { id: number; role: string; company_id: number | null }, fileId: number, ownerId: number | null): boolean {
  if (u.role === 'secretariat' || u.id === ownerId) return true
  if (!u.company_id) return false
  const c = one<{ status: string; logo_file_id: number | null; photos: string | null }>('SELECT status, logo_file_id, photos FROM companies WHERE id = ?', u.company_id)
  if (!c) return false
  if (c.status === 'active' || c.logo_file_id === fileId) return true
  try { return (JSON.parse(c.photos ?? '[]') as unknown[]).includes(fileId) } catch { return false }
}

files.get('/:key/:name', wrap((req: Request, res, next) => {
  const f = one('SELECT * FROM files WHERE key = ?', String(req.params.key))
  if (!f) throw notFound()
  const u = req.session?.user
  const allowed = f.access === 'public'
    || (f.access === 'members' && !!u && memberMaySee(u, f.id, f.owner_user_id))
    || (f.access === 'private' && !!u && (u.role === 'secretariat' || u.id === f.owner_user_id))
  if (!allowed) {
    if (!u) {
      // a members-only document: sign in, then come back to it
      return res.redirect(302, `/members/login?next=${encodeURIComponent(req.originalUrl)}`)
    }
    throw new HttpError(403, 'You do not have access to this file.')
  }
  const p = pathOf(f.key)
  if (!fs.statSync(p, { throwIfNoEntry: false })?.isFile()) throw notFound()
  const inline = /^image\/|^application\/pdf$/.test(f.mime)
  res.setHeader('Content-Type', f.mime)
  res.setHeader('Content-Length', String(f.size))
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${f.name.replace(/"/g, '')}"`)
  res.setHeader('Cache-Control', f.access === 'public' ? 'public, max-age=86400' : 'private, no-store')
  // a file that cannot be read after all (removed a moment ago, the disk): a 404, or a cut connection if it was
  // already on its way; never an error nobody catches, which would stop the whole server
  const stream = fs.createReadStream(p)
  stream.once('error', (e) => {
    console.error('[files] could not read', f.key, (e as Error).message)
    if (res.headersSent) return void res.destroy()
    for (const h of ['Content-Type', 'Content-Length', 'Content-Disposition', 'Cache-Control']) res.removeHeader(h)
    next(notFound())
  })
  stream.pipe(res)
}))
