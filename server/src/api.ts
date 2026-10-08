import fs from 'node:fs/promises'
import path from 'node:path'
import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { z } from 'zod'
import { config } from './config.js'
import { deliver } from './inbox.js'

export const api = Router()

/* ── content collections (JSON files in data/, re-read when they change, so editors need no restart) ── */

const cache = new Map<string, { mtime: number; value: unknown }>()
async function readData<T>(file: string): Promise<T> {
  const full = path.join(config.dataDir, file)
  const { mtimeMs } = await fs.stat(full)
  const hit = cache.get(full)
  if (hit && hit.mtime === mtimeMs) return hit.value as T
  const value = JSON.parse(await fs.readFile(full, 'utf8')) as T
  cache.set(full, { mtime: mtimeMs, value })
  return value
}

type Member = { slug: string; name: string; sectors: string[]; [k: string]: unknown }
type Post = { slug: string; date: string | null; [k: string]: unknown }

api.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() })
})

api.get('/members', async (req, res) => {
  const { members } = await readData<{ members: Member[] }>('members.json')
  const sector = typeof req.query.sector === 'string' ? req.query.sector : ''
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
  const list = members
    .filter((m) => !sector || m.sectors.includes(sector))
    .filter((m) => !q || m.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
  res.json({ members: list, total: members.length })
})

api.get('/members/:slug', async (req, res) => {
  const { members } = await readData<{ members: Member[] }>('members.json')
  const member = members.find((m) => m.slug === req.params.slug)
  if (!member) return void res.status(404).json({ error: 'Member not found' })
  res.json({ member })
})

api.get('/news', async (_req, res) => {
  const { posts } = await readData<{ posts: Post[] }>('news.json')
  res.json({ posts })
})

/* ── forms ── */

// generous for people, tight for bots: 12 submissions per 10 minutes per address
const formLimit = rateLimit({ windowMs: 10 * 60 * 1000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false })

const text = (max: number) => z.string().trim().max(max)
const required = (max: number) => text(max).min(1, 'Required')
const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid e-mail address'))

/** an optional head count: a blank field is "not given", not 0 */
const count = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().int().min(0).max(1_000_000).optional())

/** Bots fill every field; people never see this one. A filled honeypot gets a normal-looking "ok" (see handle). */
const honeypot = { website_url: z.string().max(500).optional() }

const schemas = {
  contact: z.object({ name: required(120), email, subject: required(200), message: required(5000), ...honeypot }),
  appointment: z.object({
    name: required(120),
    email,
    mobile: required(40),
    sector: z.enum(['Tannery', 'Shoe manufacturing', 'Leather products']),
    date: z.iso.date('Pick a date'),
    message: text(5000).optional().default(''),
    ...honeypot,
  }),
  subscribe: z.object({ email, ...honeypot }),
  membership: z.object({
    companyName: required(200),
    generalManager: required(120),
    yearEstablished: z.coerce.number().int().min(1900).max(new Date().getFullYear()),
    membershipType: z.enum(['Member', 'Associate Member']),
    region: required(80),
    subCity: text(80).optional().default(''),
    wereda: text(40).optional().default(''),
    houseNo: text(40).optional().default(''),
    tel: text(40).optional().default(''),
    mobile: required(40),
    email,
    website: text(200).optional().default(''),
    sector: z.enum(['Tannery', 'Shoe Manufacturer', 'Leather Product Manufacturer']),
    employeesMale: count,
    employeesFemale: count,
    employeesPermanent: count,
    employeesTemporary: count,
    bankAccount: text(80).optional().default(''),
    consent: z.literal('true', { error: 'Please accept the membership terms' }),
    ...honeypot,
  }),
} as const

type FormKind = keyof typeof schemas

function handle(kind: FormKind) {
  return async (req: Request, res: Response) => {
    if (req.body?.website_url) {
      if (req.file) await fs.rm(req.file.path, { force: true })
      return void res.status(201).json({ ok: true })
    }
    const parsed = schemas[kind].safeParse(req.body ?? {})
    if (!parsed.success) {
      const fields: Record<string, string> = {}
      for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message
      if (req.file) await fs.rm(req.file.path, { force: true })
      return void res.status(422).json({ error: 'Please check the highlighted fields.', fields })
    }
    const { website_url: _hp, ...data } = parsed.data as Record<string, unknown>
    const attachments = req.file ? [{ filename: req.file.originalname, path: req.file.path }] : []
    const id = await deliver(kind, req.file ? { ...data, stamp: path.basename(req.file.path) } : data, attachments)
    res.status(201).json({ ok: true, id })
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      const dir = path.join(config.inboxDir, 'stamps')
      await fs.mkdir(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(file.mimetype)),
})

api.post('/contact', formLimit, handle('contact'))
api.post('/appointments', formLimit, handle('appointment'))
api.post('/subscribe', formLimit, handle('subscribe'))
api.post('/membership', formLimit, upload.single('stamp'), handle('membership'))

api.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// multer limits and anything unexpected
api.use((err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.code === 'LIMIT_FILE_SIZE') return void res.status(413).json({ error: 'The stamp file must be under 5 MB.', fields: { stamp: 'Max 5 MB' } })
  console.error('[api]', err)
  res.status(500).json({ error: 'Something went wrong on our side. Please try again, or e-mail info@eliaet.com.' })
})
