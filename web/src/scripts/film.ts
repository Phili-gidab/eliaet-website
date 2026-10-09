/* ELIA · films: picks the right rendition for the screen (shape, size, codec), plays only while visible,
   and never autoplays for people who asked for less motion (they get the poster and a play button). */

type Renditions = { base: string; sizes: number[] }

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const probe = document.createElement('video')
const CAN: Record<string, boolean> = {
  av1: !!probe.canPlayType('video/mp4; codecs="av01.0.05M.08"'),
  hevc: !!probe.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"'),
  vp9: !!probe.canPlayType('video/webm; codecs="vp9"'),
  h264: true,
}
const ORDER = ['av1', 'hevc', 'vp9', 'h264']
const fileFor = (base: string, w: number, c: string) =>
  c === 'av1' ? `${base}-${w}-av1.mp4` : c === 'hevc' ? `${base}-${w}-hevc.mp4` : c === 'vp9' ? `${base}-${w}.webm` : `${base}-${w}.mp4`

/** Every rendition worth trying, best first: the right shape and size in each codec this browser plays, then the other shape. */
function choose(el: HTMLElement) {
  const wide = JSON.parse(el.dataset.wide || 'null') as Renditions | null
  const tall = JSON.parse(el.dataset.tall || 'null') as Renditions | null
  const fmts = (el.dataset.formats || ORDER.join(',')).split(',')
  const codecs = ORDER.filter((c) => fmts.includes(c) && CAN[c])
  const portrait = !!tall && innerHeight > innerWidth * 1.05
  const need = innerWidth * Math.min(devicePixelRatio || 1, 2)
  const list: { src: string; portrait: boolean }[] = []
  for (const [set, isTall] of (portrait ? [[tall, true], [wide, false]] : [[wide, false], [tall, true]]) as [Renditions | null, boolean][]) {
    if (!set) continue
    const sizes = [...set.sizes].sort((a, b) => a - b)
    const w = sizes.find((x) => x >= need * 0.85) ?? sizes[sizes.length - 1]
    for (const c of codecs) list.push({ src: fileFor(set.base, w, c), portrait: isTall })
  }
  return { list }
}

export function mountFilm(el: HTMLElement, opts: { onEnded?: () => void; hold?: () => boolean } = {}) {
  const video = el.querySelector('video')!
  const btn = el.querySelector<HTMLButtonElement>('[data-film-toggle]')
  let current = ''
  let userPaused = reduce && el.dataset.autoplay !== 'force'
  let visible = true
  const sync = () => {
    const want = !userPaused && visible && !(opts.hold && opts.hold())
    if (want && video.paused) video.play().catch(() => {})
    else if (!want && !video.paused) video.pause()
  }
  const failed = new Set<string>()
  const load = () => {
    const { list } = choose(el)
    const c = list.find((x) => !failed.has(x.src))
    if (!c) {
      // nothing plays here: the poster (a picture under the video, in the shape this screen wants) stays, and whoever
      // listens is told
      el.classList.add('is-still')
      el.dispatchEvent(new CustomEvent('film-unavailable'))
      return
    }
    el.classList.toggle('is-portrait', c.portrait)
    if (c.src === current) return
    current = c.src
    video.src = c.src
    video.load()
    sync()
  }
  // a rendition that will not load or decode (a missing file, a codec the browser only claims) hands over to the next
  video.addEventListener('error', () => { if (current) { failed.add(current); load() } })
  const show = () => {
    const playing = !video.paused
    el.dataset.state = playing ? 'playing' : 'paused'
    btn?.setAttribute('aria-pressed', playing ? 'false' : 'true')
    btn?.setAttribute('aria-label', playing ? 'Pause the film' : 'Play the film')
  }
  video.muted = true; video.playsInline = true
  video.loop = el.dataset.loop !== 'false'
  video.addEventListener('playing', () => { el.classList.add('is-live'); show() })
  video.addEventListener('pause', show)
  // a film that plays once stays on its last frame: coming back into view must not start it again
  video.addEventListener('ended', () => { if (!video.loop) userPaused = true })
  video.addEventListener('play', () => { userPaused = false })
  // whoever holds the film (the home film waits for the brand film) asks for a fresh look with this event
  video.addEventListener('elia-sync', sync)
  if (opts.onEnded) video.addEventListener('ended', opts.onEnded)
  btn?.addEventListener('click', () => { userPaused = !video.paused; sync() })
  show()
  load()
  let t = 0
  addEventListener('resize', () => { clearTimeout(t); t = window.setTimeout(load, 250) })
  new IntersectionObserver(([e]) => { if (e) { visible = e.isIntersecting; sync() } }, { threshold: 0.05 }).observe(el)
  return video
}

document.querySelectorAll<HTMLElement>('[data-film]:not([data-film-manual])').forEach((el) => mountFilm(el))
