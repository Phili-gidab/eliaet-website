/* ELIA website: one Node process (Express) that serves the built pages, fills the live parts of a few of them,
   and answers the forms, the members' area and the Secretariat's back office (/api). Data: one SQLite file in the
   data folder (src/db.ts). Runs the same in development (npm run dev) and on cPanel (Setup Node.js App). */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express, { type Request, type Response, type NextFunction } from 'express'
import compression from 'compression'
import helmet from 'helmet'
import { config } from './config.js'
import { db, closeDb } from './db.js'
import { seedIfEmpty } from './seed.js'
import { sweep } from './security.js'
import { loadSession, sameOrigin } from './session.js'
import { files } from './files.js'
import { auth } from './routes/auth.js'
import { forms } from './routes/forms.js'
import { member } from './routes/member.js'
import { admin } from './routes/admin.js'
import { publicApi } from './routes/public.js'
import { pages } from './pages.js'
import { HttpError, ipOf } from './util.js'

/** The pages' few small inline scripts are allowed by their hashes (found in the build), not by 'unsafe-inline'. */
function inlineScriptHashes(dir: string): string[] {
  const out = new Set<string>()
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) { if (!['_assets', 'media', 'film'].includes(e.name)) walk(p); continue }
      if (!e.name.endsWith('.html')) continue
      const html = fs.readFileSync(p, 'utf8')
      for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (/type=["']?application\/(ld\+)?json/.test(m[1]) || !m[2].trim()) continue
        out.add(`'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)
      }
    }
  }
  if (fs.existsSync(dir)) walk(dir)
  return [...out]
}

db()
seedIfEmpty()
setInterval(() => { try { sweep() } catch { /* next time */ } }, 3600 * 1000).unref()

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)          // behind cPanel's Apache (Passenger): the rate limits need the visitor's address

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // the 3D models' mesh decoder is WebAssembly; inline scripts only by hash
        scriptSrc: ["'self'", "'wasm-unsafe-eval'", ...inlineScriptHashes(config.clientDist)],
        scriptSrcAttr: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'blob:'],
        frameSrc: ['https://www.google.com'],          // the office map
        workerSrc: ["'self'", 'blob:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.isProd ? { maxAge: 15552000 } : false,
  }),
)
if (process.env.NOINDEX === '1') app.use((_req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next() })
app.use(compression())

/* ---- the API ---- */
const api = express.Router()
api.use(express.json({ limit: '200kb' }))
api.use(express.urlencoded({ extended: false, limit: '200kb' }))
api.use(loadSession, sameOrigin)
// the address the rate limits see for this visitor (after a deploy: it should be the visitor's own, not the server's)
api.get('/health', (req, res) => void res.json({ ok: true, time: new Date().toISOString(), client: ipOf(req) }))
api.use('/auth', auth)
api.use('/member', member)
api.use('/admin', admin)
api.use('/public', publicApi)
api.use(forms)
/* the old form addresses (pages built before the forms moved) */
api.post('/contact', (req, _res, next) => { req.url = '/forms/general'; next() }, forms)
api.post('/appointments', (req, _res, next) => { req.url = '/forms/appointment'; next() }, forms)
api.post('/subscribe', (req, _res, next) => { req.url = '/forms/subscribe'; next() }, forms)
api.use((_req, res) => void res.status(404).json({ error: 'Not found' }))
app.use('/api', api)

app.use('/files', loadSession, files)

/* ---- the old site's addresses keep working ---- */
const LEGACY: Record<string, string> = {
  '/index.html': '/', '/about.html': '/about', '/services.html': '/about#what-we-do', '/members.html': '/members',
  '/members-list.html': '/members', '/ehl.html': '/ehl', '/aalf.html': '/aalf', '/eldsc.html': '/eldsc', '/blog.html': '/news',
  '/contact.html': '/contact', '/apply-for-membership.html': '/members#apply',
  // pages of the first redesign that the content document folded into others
  '/services': '/about#what-we-do', '/membership': '/members#apply',
}
app.use((req, res, next) => {
  const to = LEGACY[req.path.toLowerCase()]
  if (to) return res.redirect(301, to)
  const img = /^\/img\/(.+)\.(jpe?g|png)$/i.exec(req.path)
  if (img) return res.redirect(301, `/media/${img[1]}.webp`)
  if ((req.method === 'GET' || req.method === 'HEAD') && req.path.length > 1 && req.path.endsWith('/')) {
    return res.redirect(301, req.path.replace(/\/+$/, '') + req.originalUrl.slice(req.path.length))
  }
  next()
})

/* ---- pages with live parts, then the built site ---- */
app.use(pages)
/** The site's 404 page (the API answers 404 in JSON). */
function notFoundPage(req: Request, res: Response) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return void res.status(404).json({ error: 'Not found' })
  const page = path.join(config.clientDist, '404.html')
  res.status(404).setHeader('Cache-Control', 'no-cache')
  if (fs.existsSync(page)) return res.sendFile(page)
  res.type('text').send('Not found')
}
/* the templates the live pages are made from are not pages themselves */
app.use('/templates', notFoundPage)

/* the members' area and the back office: one built page each for every address under it */
const shell = (file: string) => (_req: Request, res: Response, next: NextFunction) => {
  const p = path.join(config.clientDist, file)
  if (!fs.existsSync(p)) return next()
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Robots-Tag', 'noindex')
  res.sendFile(p)
}
app.get('/members/company/:slug', shell('members/company.html'))
app.get('/admin', shell('admin.html'))

if (fs.existsSync(config.clientDist)) {
  const YEAR = 'public, max-age=31536000, immutable'
  const headers = (res: Response, file: string) => {
    const rel = path.relative(config.clientDist, file).split(path.sep)
    if (rel[0] === '_assets') res.setHeader('Cache-Control', YEAR)
    else if (file.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache')
      if (rel[0] === 'members' || rel[0] === 'admin.html') res.setHeader('X-Robots-Tag', 'noindex')
    } else if (['film', 'media'].includes(rel[0])) res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    else res.setHeader('Cache-Control', 'public, max-age=3600')
  }
  /* a clean address whose name is also a folder (/members, beside members/login.html): the page, not the folder */
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || path.extname(req.path) || req.path === '/') return next()
    let rel: string
    try { rel = decodeURIComponent(req.path) } catch { return next() }
    const file = path.join(config.clientDist, rel + '.html')
    if (!file.startsWith(config.clientDist + path.sep) || !fs.existsSync(path.join(config.clientDist, rel))) return next()
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return next()
      headers(res, file)
      res.sendFile(file)
    })
  })
  app.use(express.static(config.clientDist, { index: 'index.html', extensions: ['html'], redirect: false, setHeaders: headers }))
  app.use(notFoundPage)
} else if (config.isProd) {
  console.warn(`[server] no site build at ${config.clientDist}: run "npm run build" first`)
}

/* ---- errors: a JSON answer for the API, the 404 or a short page otherwise ---- */
app.use((err: Error & { code?: string; status?: number; type?: string }, req: Request, res: Response, _next: NextFunction) => {
  let status = 500, body: Record<string, unknown> = { error: `Something went wrong on our side. Please try again, or e-mail ${config.contactEmail}.` }
  if (err instanceof HttpError) { status = err.status; body = { error: err.message, ...(err.fields ? { fields: err.fields } : {}) } }
  else if (err.code === 'LIMIT_FILE_SIZE') { status = 413; body = { error: 'The file is too large.' } }
  else if (err.code?.startsWith('LIMIT_')) { status = 400; body = { error: 'Too many files or fields.' } }
  else if (err.type === 'entity.too.large') { status = 413; body = { error: 'That is too much to send at once.' } }
  else if (err.type === 'entity.parse.failed') { status = 400; body = { error: 'The request could not be read.' } }
  else console.error('[server]', req.method, req.originalUrl, err)
  if (res.headersSent) return
  res.status(status)
  if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) return void res.json(body)
  res.type('text').send(String(body.error))
})

const server = app.listen(config.port, () => {
  console.log(`[server] ELIA on http://localhost:${config.port} · data in ${config.dataDir} · e-mail ${config.mail.outboxOnly ? 'to data/outbox (not sent)' : config.mail.smtp ? 'by SMTP' : config.mail.sendmail ? 'by sendmail' : 'off'}`)
})
const stop = () => { server.close(() => { closeDb(); process.exit(0) }); setTimeout(() => process.exit(0), 5000).unref() }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
