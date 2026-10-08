import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import compression from 'compression'
import helmet from 'helmet'
import cors from 'cors'
import { config } from './config.js'
import { api } from './api.js'

/**
 * The pages carry a few small inline scripts (the "js" class set before paint, the countdown, the directory filter).
 * Rather than allow every inline script, the policy lists the hash of each one found in the build.
 */
function inlineScriptHashes(dir: string): string[] {
  const out = new Set<string>()
  if (!fs.existsSync(dir)) return []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html')) continue
    const html = fs.readFileSync(path.join(dir, f), 'utf8')
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/type=["']?application\/(ld\+)?json/.test(m[1]) || !m[2].trim()) continue
      out.add(`'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`)
    }
  }
  return [...out]
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1) // behind cPanel/Apache or nginx: rate limiting needs the real client address

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // the boot's mesh decoder is WebAssembly; inline scripts are allowed only by hash
        scriptSrc: ["'self'", "'wasm-unsafe-eval'", ...inlineScriptHashes(config.clientDist)],
        imgSrc: ["'self'", 'data:', 'blob:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'blob:'], // the boot's textures are unpacked to blob: URLs and fetched
        frameSrc: ['https://www.google.com'], // the office map
        workerSrc: ["'self'", 'blob:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)
app.use(compression())
if (!config.isProd) app.use(cors())
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: false, limit: '100kb' }))

app.use('/api', api)

/* The old site's addresses keep working: pages and images moved, so send people (and search engines) on. */
const LEGACY: Record<string, string> = {
  '/index.html': '/',
  '/about.html': '/about',
  '/services.html': '/services',
  '/members.html': '/members',
  '/members-list.html': '/members',
  '/ehl.html': '/ehl',
  '/aalf.html': '/aalf',
  '/eldsc.html': '/eldsc',
  '/blog.html': '/news',
  '/contact.html': '/contact',
  '/apply-for-membership.html': '/membership',
}
app.use((req, res, next) => {
  const to = LEGACY[req.path.toLowerCase()]
  if (to) return res.redirect(301, to)
  const img = /^\/img\/(.+)\.(jpe?g|png)$/i.exec(req.path)
  if (img) return res.redirect(301, `/media/${img[1]}.webp`)
  next()
})

/* Pages have clean addresses (/about is about.html); a trailing slash is dropped. */
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && req.path.length > 1 && req.path.endsWith('/')) {
    const q = req.originalUrl.slice(req.path.length)
    return res.redirect(301, req.path.replace(/\/+$/, '') + q)
  }
  next()
})

/* In production the built site is served from here too: one origin, one process. */
if (fs.existsSync(config.clientDist)) {
  const ONE_YEAR = 'public, max-age=31536000, immutable'
  app.use(
    express.static(config.clientDist, {
      index: 'index.html',
      extensions: ['html'],
      redirect: false,
      setHeaders(res, file) {
        const rel = path.relative(config.clientDist, file).split(path.sep)
        if (rel[0] === '_assets') res.setHeader('Cache-Control', ONE_YEAR) // hashed names: never change
        else if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache') // always revalidate (cheap: ETag)
        else if (['film', 'models', 'media'].includes(rel[0])) res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
        else res.setHeader('Cache-Control', 'public, max-age=3600')
      },
    }),
  )
  const notFound = path.join(config.clientDist, '404.html')
  app.use((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(404).json({ ok: false, error: 'Not found' })
    res.status(404).setHeader('Cache-Control', 'no-cache')
    if (fs.existsSync(notFound)) return res.sendFile(notFound)
    res.type('text').send('Not found')
  })
} else if (config.isProd) {
  console.warn(`[server] no site build at ${config.clientDist} — run "npm run build" first`)
}

app.listen(config.port, () => {
  console.log(`[server] ELIA API on http://localhost:${config.port}${config.smtp ? ' · e-mail on' : ' · e-mail off (inbox only)'}`)
})
