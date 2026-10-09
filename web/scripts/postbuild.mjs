// After every build:
// - Astro's content layer leaves two empty module stubs in the output; nothing links to them, so they are not shipped.
// - sitemap.xml lists every page at its clean address (/about, not /about.html), and robots.txt points to it.
//   With NOINDEX=1 (a temporary home, see hosting/bundle.mjs) robots.txt keeps search engines out and there is no sitemap.
import fs from 'node:fs'
import path from 'node:path'

const dist = path.resolve(process.argv[2] ?? 'dist')
const SITE = (process.env.SITE_URL || 'https://www.eliaet.com').replace(/\/+$/, '')
const NOINDEX = process.env.NOINDEX === '1'

for (const f of ['content-assets.mjs', 'content-modules.mjs']) fs.rmSync(path.join(dist, f), { force: true })

const today = new Date().toISOString().slice(0, 10)
const pages = fs
  .readdirSync(dist)
  .filter((f) => f.endsWith('.html') && f !== '404.html')
  .map((f) => (f === 'index.html' ? '/' : '/' + f.replace(/\.html$/, '')))
  .sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)))
const urls = pages
  .map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod><priority>${p === '/' ? '1.0' : '0.8'}</priority></url>`)
  .join('\n')
if (NOINDEX) {
  fs.rmSync(path.join(dist, 'sitemap.xml'), { force: true })
  fs.writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
  console.log(`postbuild: robots.txt keeps search engines out (${SITE}), no sitemap`)
} else {
  fs.writeFileSync(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  )
  fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`)
  console.log(`postbuild: sitemap.xml (${pages.length} pages), robots.txt`)
}
