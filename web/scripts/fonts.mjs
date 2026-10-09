// Before every build (and `npm run dev`): the Ge'ez labels use a few dozen Ethiopic letters, but the full Noto Sans
// Ethiopic is about 200 kB. This makes a copy of the font with only the letters the site uses (found in src/ and in
// the server's data files), about 15 kB, at src/fonts/noto-sans-ethiopic-subset.woff2 (src/styles/fonts.css loads it).
// It does the work only when the letters change; the list it was made for is kept next to it.
//
// If the subsetting library is missing or fails, the build goes on: with the copy made last time if there is one,
// otherwise with the full font, so the site always has every letter.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repo = path.resolve(web, '..')
const OUT = path.join(web, 'src', 'fonts', 'noto-sans-ethiopic-subset.woff2')
const LIST = OUT.replace(/\.woff2$/, '.txt')
const FULL = require.resolve('@fontsource-variable/noto-sans-ethiopic/files/noto-sans-ethiopic-ethiopic-wght-normal.woff2')
const ETHIOPIC = /[ሀ-᎟ⶀ-⷟꬀-꬯]/gu

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(astro|ts|js|mjs|md|mdx|json|html)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = [...walk(path.join(web, 'src')), ...walk(path.join(repo, 'server', 'data'))]
const letters = new Set()
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(ETHIOPIC)) letters.add(m[0])
const text = [...letters].sort().join('')

const before = fs.existsSync(LIST) ? fs.readFileSync(LIST, 'utf8').trim() : ''
if (before === text && fs.existsSync(OUT)) {
  console.log(`fonts: Ethiopic subset up to date (${letters.size} letters)`)
  process.exit(0)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
try {
  const { default: subsetFont } = await import('subset-font')
  const font = await subsetFont(fs.readFileSync(FULL), text, { targetFormat: 'woff2' })
  fs.writeFileSync(OUT, font)
  fs.writeFileSync(LIST, text + '\n')
  console.log(`fonts: Ethiopic subset made, ${letters.size} letters, ${Math.round(font.length / 1024)} kB`)
} catch (err) {
  if (fs.existsSync(OUT)) {
    console.warn(`fonts: could not remake the Ethiopic subset (${err.message}); using the one made before, which may lack new letters`)
  } else {
    fs.copyFileSync(FULL, OUT)
    fs.writeFileSync(LIST, '')
    console.warn(`fonts: could not make the Ethiopic subset (${err.message}); using the full font`)
  }
}
