/* ELIA · the home film's story: the film is the clock.
   Every frame, the film's own time decides which chapter's words are in (scrubbing, pausing or a slow phone all
   stay in step), the rail's segments fill with it, and a click on a segment goes to that chapter. The film plays
   once and stays on its last frame, where the last chapter (the page's title and buttons) stands; the button at
   the end of the rail plays it again. People who asked for less motion get that last frame and chapter at once.
   Scrolling on, the film steps back into a panel (--away) while the next section slides over it. */
import { mountFilm } from './film'

type Beat = { id: string; t0: number; t1: number; in: number; out: number | null }

const root = document.querySelector<HTMLElement>('[data-story]')
if (root) {
  const { end: END, chapters } = JSON.parse(root.dataset.beats || '{}') as { end: number; chapters: Beat[] }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const filmEl = root.querySelector<HTMLElement>('[data-film]')!
  const stage = root.querySelector<HTMLElement>('[data-story-stage]')!
  const chEls = new Map(chapters.map((c) => [c.id, root.querySelector<HTMLElement>(`[data-ch="${c.id}"]`)!]))
  const segs = new Map(chapters.map((c) => [c.id, root.querySelector<HTMLElement>(`[data-seek="${c.id}"]`)!]))
  const btn = root.querySelector<HTMLButtonElement>('[data-story-toggle]')!
  let ended = false
  // on a first visit the brand film plays first: this one waits at its first frame until that is done
  const html = document.documentElement
  let holding = !!document.querySelector('[data-intro]') && !html.classList.contains('no-intro') && !reduce

  const video = mountFilm(filmEl, {
    onEnded: () => { ended = true; root.classList.add('is-end'); draw(END) },
    hold: () => holding,
  })
  video.loop = false
  if (holding) {
    const mo = new MutationObserver(() => {
      if (html.classList.contains('intro-done') || html.classList.contains('no-intro')) {
        holding = false
        mo.disconnect()
        try { video.currentTime = 0 } catch (e) { /* not loaded yet */ }
        video.dispatchEvent(new Event('elia-sync'))
      }
    })
    mo.observe(html, { attributes: true, attributeFilter: ['class'] })
  }

  /* the copy and the rail at time t */
  const draw = (t: number) => {
    let current = chapters[0].id
    for (const c of chapters) {
      const el = chEls.get(c.id)
      if (!el) continue
      const on = t >= c.in && (c.out === null || t < c.out)
      const gone = !on && t >= c.in
      el.classList.toggle('on', on)
      el.classList.toggle('gone', gone && c.out !== null)
      el.setAttribute('aria-hidden', on ? 'false' : 'true')
      if (t >= c.t0) current = c.id
      const p = Math.min(1, Math.max(0, (t - c.t0) / (c.t1 - c.t0)))
      segs.get(c.id)?.style.setProperty('--p', p.toFixed(4))
    }
    segs.forEach((s, id) => s.classList.toggle('on', id === current))
    root.dataset.chapter = current
  }

  const state = () => {
    root.dataset.state = video.paused ? 'paused' : 'playing'
    const label = ended ? 'Play the film again' : video.paused ? 'Play the film' : 'Pause the film'
    btn.setAttribute('aria-label', label)
    btn.setAttribute('aria-pressed', video.paused ? 'true' : 'false')
  }
  video.addEventListener('play', state)
  video.addEventListener('pause', state)

  /* the pins: each one's thing, frame by frame, as the film's camera sees it (x, y of the film's frame, from the
     film's own cameras), carried onto the screen the way the film covers the stage */
  type PinTrack = { on: [number, number]; f0: number; step: number; xy: number[] }
  const pinRoot = root.querySelector<HTMLElement>('[data-pins]')
  const pinEls = [...root.querySelectorAll<HTMLElement>('[data-pin]')]
  let pinData: { fps: number; pins: Record<string, { w?: PinTrack; t?: PinTrack }> } | null = null
  if (pinRoot && pinEls.length && !reduce) {
    fetch(pinRoot.dataset.pins!).then((r) => (r.ok ? r.json() : null)).then((j) => { pinData = j }).catch(() => {})
  }
  // sizes that only change with the layout: the header's height, each pin's stem and tag
  let headerH = 80
  const sizes = new Map<HTMLElement, { stem: number; w: number; h: number }>()
  const measure = () => {
    headerH = document.querySelector<HTMLElement>('[data-header]')?.offsetHeight ?? 80
    for (const el of pinEls) {
      const tag = el.querySelector<HTMLElement>('.pin__tag'), stem = el.querySelector<HTMLElement>('.pin__stem')
      sizes.set(el, { stem: stem?.offsetHeight ?? 46, w: tag?.offsetWidth ?? 120, h: tag?.offsetHeight ?? 26 })
    }
  }
  measure()
  addEventListener('resize', measure)
  document.fonts?.ready.then(measure)
  // the words of the chapter that is in, as a box in the stage (layout, so the scroll-away scaling does not matter)
  const copyEl = root.querySelector<HTMLElement>('.story__copy')
  const keepOut = () => {
    const ch = root.querySelector<HTMLElement>('.ch.on')
    if (!ch || !copyEl) return null
    const x = copyEl.offsetLeft + ch.offsetLeft, y = copyEl.offsetTop + ch.offsetTop
    return { x0: x, y0: y, x1: x + ch.offsetWidth, y1: y + ch.offsetHeight }
  }
  const pins = (t: number) => {
    if (!pinData) return
    const portrait = filmEl.classList.contains('is-portrait')
    const W = filmEl.clientWidth, H = filmEl.clientHeight
    const vw = video.videoWidth || (portrait ? 9 : 16), vh = video.videoHeight || (portrait ? 16 : 9)
    const s = Math.max(W / vw, H / vh), ox = (W - vw * s) / 2, oy = (H - vh * s) / 2
    const f = t * pinData.fps + 1                              // the film's frame (1 = its first), with a fraction
    const k = keepOut()
    type Box = { x0: number; y0: number; x1: number; y1: number }
    const apart = (b: Box, o: Box, room: number) => b.x1 + room < o.x0 || b.x0 - room > o.x1 || b.y1 + room < o.y0 || b.y0 - room > o.y1
    const cands: { el: HTMLElement; was: boolean; b: Box | null }[] = []
    for (const el of pinEls) {
      const tr = pinData.pins[el.dataset.pin!]?.[portrait ? 't' : 'w']
      const was = el.classList.contains('on')
      let on = false
      let box: Box | null = null
      if (tr && !ended) {
        const n = tr.xy.length / 2
        const u = (f - tr.f0) / tr.step
        if (u >= 0 && u <= n - 1) {
          const i = Math.floor(u), j = Math.min(n - 1, i + 1), a = u - i
          const x = (tr.xy[2 * i] + (tr.xy[2 * j] - tr.xy[2 * i]) * a) / 1e4
          const y = (tr.xy[2 * i + 1] + (tr.xy[2 * j + 1] - tr.xy[2 * i + 1]) * a) / 1e4
          const px = ox + x * vw * s, py = oy + y * vh * s
          el.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`
          // near the right edge the tag hangs to the left of its stem (with some give, so it does not flap)
          if (px > W - 190) el.classList.add('is-l')
          else if (px < W - 240) el.classList.remove('is-l')
          const left = el.classList.contains('is-l')
          // the pin's whole shape (dot, stem, tag) must stay clear of the header, the edges and the chapter's words;
          // a pin that is out needs some room to come in, one that is in only leaves when it really touches
          const z = sizes.get(el) ?? { stem: 46, w: 120, h: 26 }
          const room = was ? 0 : 18
          const b = { x0: left ? px - z.w : px - 8, x1: left ? px + 8 : px + z.w, y0: py - z.stem - 9 - z.h, y1: py + 8 }
          on = f >= tr.on[0] && f <= tr.on[1] && (!k || apart(b, k, room)) && b.x0 > 8 && b.x1 < W - 8 && b.y0 > headerH + 6 && b.y1 < H - 70
          if (on) box = b
        }
      }
      cands.push({ el, was, b: box })
    }
    // pins keep off each other too: those already in keep their place, newcomers need room
    const shown: Box[] = []
    const keep = new Set<HTMLElement>()
    for (const pass of [true, false]) {
      for (const c of cands) {
        if (!c.b || c.was !== pass) continue
        if (shown.every((o) => apart(c.b!, o, pass ? 0 : 18))) { shown.push(c.b); keep.add(c.el) }
      }
    }
    for (const c of cands) if (c.was !== keep.has(c.el)) c.el.classList.toggle('on', keep.has(c.el))
  }

  // the clock: the film's time, every frame it shows (rVFC where there is one: it gives the shown frame's own time)
  const tick = (_now?: number, meta?: { mediaTime?: number }) => {
    if (!ended) draw(video.currentTime || 0)
    pins(meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : video.currentTime || 0)
    schedule()
  }
  const schedule = () => {
    if ('requestVideoFrameCallback' in video && !video.paused) (video as any).requestVideoFrameCallback(tick)
    else requestAnimationFrame(tick)
  }
  schedule()

  const restart = (t = 0) => {
    ended = false
    root.classList.remove('is-end')
    try { video.currentTime = t } catch (e) { /* not seekable yet */ }
    draw(t)
    video.play().catch(() => {})
  }
  btn.addEventListener('click', () => {
    if (ended) restart(0)
    else if (video.paused) video.play().catch(() => {})
    else video.pause()
  })
  segs.forEach((s, id) => s.addEventListener('click', () => {
    const c = chapters.find((x) => x.id === id)!
    restart(Math.max(0, c.in - 0.4))
  }))

  // a film that cannot play here (no file, no codec, a very slow line): the last frame and chapter, as for less motion
  const giveUp = () => { if (!ended && video.paused && video.readyState < 3) { ended = true; root.classList.add('is-end'); draw(END); state() } }
  filmEl.addEventListener('film-unavailable', giveUp)
  // ...and if it does start after all, the story picks up in step with it
  video.addEventListener('playing', () => {
    if (ended && video.currentTime < END - 1) { ended = false; root.classList.remove('is-end') }
  })
  setTimeout(() => { if (!holding) giveUp() }, 7000)

  // less motion: the last frame and the last chapter, the film one click away
  if (reduce) {
    ended = true
    root.classList.add('is-end')
    draw(END)
  } else {
    draw(0)
  }
  state()

  /* scrolling on: the film steps back into a panel as the next section comes over it */
  let ticking = false
  const away = () => {
    const vh = innerHeight
    const p = Math.min(1, Math.max(0, scrollY / (vh * 0.75)))
    stage.style.setProperty('--away', p.toFixed(4))
    ticking = false
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(away) } }, { passive: true })
  away()
}
