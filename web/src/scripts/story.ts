/* ELIA · the home film's story: the film is the clock.
   Every frame, the film's own time decides which chapter's words are in (scrubbing, pausing or a slow phone all
   stay in step), the rail's segments fill with it, and a click on a segment goes to that chapter. The film plays
   once and stays on its last frame, where the last chapter (the page's title and buttons) stands; the button at
   the end of the rail plays it again. People who asked for less motion get that last frame and chapter at once.
   Before all that, the door: the page colour with the ELIA mark cut out of it, the film inside the mark (its first
   chapters, round and round). Scrolling zooms through the mark's dot until the film fills the screen; then the
   story begins. Scrolling on, the film steps back into a panel (--away) while the next section slides over it. */
import { mountFilm } from './film'
import { ScrollTrigger } from './motion'
import { DOT } from '../brand/logo'

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
  // on a first visit to another page the brand film plays first: this one waits at its first frame until that is done
  const html = document.documentElement
  let holding = !!document.querySelector('[data-intro]') && !html.classList.contains('no-intro') && !reduce

  /* ── the door ── */
  const door = root.querySelector<SVGSVGElement>('[data-door]')
  const useDoor = !!door && !reduce
  let open = !useDoor
  // the film's first chapters play round and round inside the mark while the door is closed
  const LOOP_FROM = 0.15, LOOP_TO = chapters[1] ? chapters[1].out ?? 7 : 3
  const DOOR = 1.15                                   // screens of scrolling to open it (as --door in Story.astro)

  // the pointer over the stage, smoothed (-1 to 1 each way): the last frame follows it
  const ptr = { x: 0, y: 0 }

  /* the last frame, alive (scripts/hero-gl.ts): depth that follows the pointer, cloud shadows, the chimney's smoke.
     Only with motion, not on a data-saving connection, and loaded only once the film has ended */
  const smoke = root.querySelector<HTMLCanvasElement>('[data-smoke]')
  let live: import('./hero-gl').HeroGL | null = null
  let liveStarting = false
  const goLive = () => {
    if (live) { live.start(); return }
    if (reduce || !smoke || liveStarting || (navigator as any).connection?.saveData) return
    liveStarting = true
    const portrait = filmEl.classList.contains('is-portrait')
    const src = portrait ? '/film/tannery-m-end-720.webp' : '/film/tannery-end-1600.webp'
    import('./hero-gl')
      .then(({ mountHeroGL }) => mountHeroGL(smoke, src, portrait, () => ptr))
      .then((g) => {
        if (!g) return
        live = g
        new IntersectionObserver(([e]) => { if (e?.isIntersecting && root.classList.contains('is-end')) g.start(); else g.stop() }).observe(root)
        g.start()
        requestAnimationFrame(() => smoke.classList.add('is-on'))
      })
      .catch(() => {})
  }

  const video = mountFilm(filmEl, {
    onEnded: () => { ended = true; root.classList.add('is-end'); draw(END); goLive() },
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
    if (!pinData || !open) return
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

  // the pace: the film was rendered to run 20 s; it plays brisker. The walk through the works runs at FAST, the way
  // out of the door to the hills (the last chapter, where the logo comes together on the hillside) nearer its own
  // speed. About 14 s in all. The words, the pins and the rail all follow the film's own time, so they keep in step.
  const FAST = 1.6, SLOW = 1.1, SLOW_FROM = 15.6
  let rate = 0
  const pace = (t: number) => {
    const want = t < SLOW_FROM ? FAST : SLOW
    if (want === rate && video.playbackRate === want) return
    rate = want
    video.defaultPlaybackRate = want
    video.playbackRate = want
  }

  // the clock: the film's time, every frame it shows (rVFC where there is one: it gives the shown frame's own time)
  const tick = (_now?: number, meta?: { mediaTime?: number }) => {
    const t = video.currentTime || 0
    // behind the closed door, the first chapters again and again
    if (!open && !ended && t > LOOP_TO) { try { video.currentTime = LOOP_FROM } catch (e) { /* not seekable yet */ } }
    pace(t)
    if (!ended) draw(t)
    pins(meta && typeof meta.mediaTime === 'number' ? meta.mediaTime : t)
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
    live?.stop()
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
  const giveUp = () => { if (!ended && video.paused && video.readyState < 3) { ended = true; root.classList.add('is-end'); draw(END); state(); goLive() } }
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

  /* ── the door: the mark is placed and zoomed through its dot as the page scrolls ── */
  if (useDoor && door) {
    const mark = door.querySelector<SVGGElement>('[data-door-mark]')!
    const edge = door.querySelector<SVGGElement>('[data-door-edge]')!
    const view = root.querySelector<HTMLElement>('[data-story-view]')!
    root.style.setProperty('--door', String(DOOR))
    root.classList.add('has-door')
    // the door is this visit's logo moment: the other pages skip their logo loader from now on
    try { sessionStorage.setItem('elia-intro', '1') } catch (e) { /* private mode */ }
    root.dataset.tone = 'light'
    // the mark's box and its dot, in the logo's own units (brand/logo.ts VIEW.mark)
    const BOX = { x: 237.9, y: 215.7, w: 146, h: 131.8 }
    const C = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 }
    const smooth = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
    let last = -1
    const place = (p: number) => {
      const W = stage.clientWidth, H = stage.clientHeight
      const w0 = Math.min(W * 0.8, H * 0.5 * (BOX.w / BOX.h))      // the mark's width when the door is closed
      const s0 = w0 / BOX.w
      const s1 = (Math.hypot(W / 2, H / 2) * 1.1) / DOT.r            // the dot covers the whole screen
      const k = smooth(0, 0.55, p)                                   // the dot comes to the middle early on
      const s = s0 * Math.pow(s1 / s0, Math.pow(p, 1.15))
      const ax = C.x + (DOT.cx - C.x) * k, ay = C.y + (DOT.cy - C.y) * k
      const tx = W / 2 - ax * s, ty = H * (0.43 + 0.07 * k) - ay * s
      const tr = `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})`
      mark.setAttribute('transform', tr)
      edge.setAttribute('transform', tr)
      root.style.setProperty('--edge', String(1 - smooth(0, 0.18, p)))
      root.style.setProperty('--hello', String(1 - smooth(0, 0.2, p)))
      view.style.setProperty('--view-s', String(1.18 - 0.18 * smooth(0, 1, p)))
      const isOpen = p >= 0.985
      if (isOpen !== open) {
        open = isOpen
        root.classList.toggle('is-open', open)
        if (open) { draw(video.currentTime || 0); video.dispatchEvent(new Event('elia-sync')) }
      }
      const tone = p > 0.6 ? 'dark' : 'light'
      if (root.dataset.tone !== tone) { root.dataset.tone = tone; dispatchEvent(new Event('elia-tone')) }
      last = p
    }
    ScrollTrigger.create({
      trigger: root, start: 'top top', end: () => `+=${innerHeight * DOOR}`,
      onUpdate: (st) => place(st.progress),
      onRefresh: (st) => place(st.progress),
    })
    place(0)
    root.classList.add('door-ready')
    dispatchEvent(new Event('elia-tone'))
    addEventListener('resize', () => place(Math.max(0, last)))
  } else {
    root.classList.add('is-open')
  }

  /* ── the final frame follows the pointer a little (it also drifts on its own: Story.astro) ── */
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0
    const step = () => {
      x += (tx - x) * 0.06; y += (ty - y) * 0.06
      ptr.x = x; ptr.y = y
      stage.style.setProperty('--px', x.toFixed(4)); stage.style.setProperty('--py', y.toFixed(4))
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.001 ? requestAnimationFrame(step) : 0
    }
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect()
      tx = ((e.clientX - r.left) / r.width) * 2 - 1
      ty = ((e.clientY - r.top) / r.height) * 2 - 1
      if (!raf) raf = requestAnimationFrame(step)
    })
  }

  /* scrolling on: the film steps back into a panel as the next section comes over it */
  let ticking = false
  const away = () => {
    const vh = innerHeight
    const from = useDoor ? vh * DOOR : 0
    const p = Math.min(1, Math.max(0, (scrollY - from) / (vh * 0.75)))
    stage.style.setProperty('--away', p.toFixed(4))
    ticking = false
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(away) } }, { passive: true })
  away()
}
