/* Responsive pictures: the large photos in public/media have smaller copies next to them (name-480.webp,
   name-720.webp, name-960.webp, name-1280.webp, made by tools/media_variants.py). responsive() lists whichever
   copies exist in a srcset, with the photo itself as the largest, so a phone downloads a copy sized for it. A photo
   without copies gets no srcset and works as before. Runs at build time only. */
import fs from 'node:fs'
import path from 'node:path'

const WIDTHS = [480, 720, 960, 1280]
const PUBLIC = [path.resolve(process.cwd(), 'public'), path.resolve(process.cwd(), 'web', 'public')].find((p) => fs.existsSync(p)) ?? ''

/** The width of a WebP file, read from its header (lossy, lossless and extended files). */
function webpWidth(file: string): number | undefined {
  let fd: number | undefined
  try {
    fd = fs.openSync(file, 'r')
    const b = Buffer.alloc(30)
    fs.readSync(fd, b, 0, 30, 0)
    if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return undefined
    const chunk = b.toString('ascii', 12, 16)
    if (chunk === 'VP8 ') return b.readUInt16LE(26) & 0x3fff
    if (chunk === 'VP8L') return (b.readUInt32LE(21) & 0x3fff) + 1
    if (chunk === 'VP8X') return b.readUIntLE(24, 3) + 1
    return undefined
  } catch {
    return undefined
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

const cache = new Map<string, string | undefined>()

/** srcset for a picture under /media, or undefined when it has no smaller copies. */
export function srcsetFor(src: string | undefined): string | undefined {
  if (!src || !PUBLIC || !src.startsWith('/media/') || !src.endsWith('.webp')) return undefined
  if (cache.has(src)) return cache.get(src)
  const file = path.join(PUBLIC, src)
  const full = webpWidth(file)
  let out: string | undefined
  if (full) {
    const stem = src.slice(0, -'.webp'.length)
    const parts = WIDTHS.filter((w) => w < full && fs.existsSync(path.join(PUBLIC, `${stem}-${w}.webp`))).map((w) => `${stem}-${w}.webp ${w}w`)
    if (parts.length) out = [...parts, `${src} ${full}w`].join(', ')
  }
  cache.set(src, out)
  return out
}

/** srcset and sizes for an <img>, to spread into it: <img src={s} {...responsive(s, '(max-width: 900px) 92vw, 520px')} /> */
export function responsive(src: string | undefined, sizes: string): { srcset?: string; sizes?: string } {
  const srcset = srcsetFor(src)
  return srcset ? { srcset, sizes } : {}
}
