/* ELIA · the home film's story: the film is the clock.
   Every frame, the film's own time decides which chapter's words are in (scrubbing, pausing or a slow phone all
   stay in step), the rail's segments fill with it, and a click on a segment goes to that chapter. The film plays
   once and stays on its last frame, where the last chapter (the page's title and buttons) stands; the button at
   the end of the rail plays it again. People who asked for less motion get that last frame and chapter at once.
   Before all that, the door (scripts/door-gl.ts, drawn on the graphics card): the logo plays its own opening, as in
   the brand film (the outline of Ethiopia, the e drawn out of its western point, the dot dropping in, the wordmark
   sliding out), then the film fills the mark and starts, in slow motion. A moment later the page goes on by itself:
   the e gives way and it glides through the mark's dot until the film fills the screen (the same distance a visitor
   would scroll, so scrolling back up closes the door again). As the door opens the film comes up to its own pace,
   gently, and the first chapter's words stay a few seconds whenever the door opened; then it plays at its own pace. Whoever scrolls, taps or presses a key first is in
   charge instead. Scrolling on, the film is held and the next section slides up over it (scripts/motion.ts). */
import { mountFilm } from './film'
import { gsap, ScrollTrigger, lenis } from './motion'
import { mountDoor, type Door } from './door-gl'

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
  const doorCanvas = root.querySelector<HTMLCanvasElement>('[data-door]')
  let useDoor = !!doorCanvas && !reduce
  let open = !useDoor
  const DOOR = 1.6                                    // screens of scrolling to open it (as --door in Story.astro)
  const BEHIND = 0.3                                  // the film's pace inside the mark, slow motion, before the door opens
  const FIRST_FOR = 3.2                               // seconds the first chapter's words stay once the door is open
  // the film waits at its first frame until it fills the mark (scripts/door-gl.ts), then runs on behind the door
  let started = !useDoor

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
        new IntersectionObserver(([e]) => { if (e?.isIntersecting && !covered && root.classList.contains('is-end')) g.start(); else g.stop() }).observe(root)
        g.start()
        requestAnimationFrame(() => smoke.classList.add('is-on'))
      })
      .catch(() => {})
  }

  // under the next sections, out of sight (scripts/motion.ts): the film and the live last frame rest
  let covered = false
  root.addEventListener('sheet-covered', (e) => {
    covered = (e as CustomEvent<boolean>).detail
    video.dispatchEvent(new Event('elia-sync'))
    if (covered) live?.stop()
    else if (ended) live?.start()
  })

  const video = mountFilm(filmEl, {
    onEnded: () => { ended = true; root.classList.add('is-end'); draw(END); goLive() },
    // (it waits for the brand film, and at its first frame while the door is shut, so the story starts at its first
    // chapter as the door opens; it rests while covered, and once it has ended it stays on its last frame)
    hold: () => holding || !started || covered || ended,
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
  // The first chapter runs at FIRST: as slow as it takes for its words to stay FIRST_FOR seconds after the door opens
  // (set again as it opens, from where the film has got to behind the door). The speed eases from one pace to the
  // next, so it never jumps.
  const FAST = 1.6, SLOW = 1.1, SLOW_FROM = 15.6
  let FIRST = Math.min(FAST, chapters[0].t1 / FIRST_FOR)
  let rate = 0, paced = 0
  const pace = (t: number) => {
    const want = !open ? BEHIND : t < chapters[0].t1 ? FIRST : t < SLOW_FROM ? FAST : SLOW
    // eased in real time (about half a second), however many frames the film shows meanwhile
    const now = performance.now(), dt = paced ? Math.min(0.25, (now - paced) / 1000) : 0
    paced = now
    rate = rate ? rate + (want - rate) * (1 - Math.exp(-dt / 0.35)) : want
    if (Math.abs(want - rate) < 0.01) rate = want
    if (Math.abs(video.playbackRate - rate) < 0.008) return
    video.defaultPlaybackRate = rate
    video.playbackRate = rate
  }
  // the film let go: at the end of the logo's opening as it fills the mark (or at once, when a visitor scrolls first)
  const startFilm = () => {
    if (started) return
    started = true
    arm()
    video.dispatchEvent(new Event('elia-sync'))
  }

  // the clock: the film's time, every frame it shows (rVFC where there is one: it gives the shown frame's own time)
  const tick = (_now?: number, meta?: { mediaTime?: number }) => {
    const t = video.currentTime || 0
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
  // (counted from when the film is first let play: while the door is shut it waits at its first frame on purpose)
  let armed = false
  const arm = () => { if (!armed) { armed = true; setTimeout(() => { if (!holding) giveUp() }, 7000) } }
  if (!useDoor) arm()

  // less motion: the last frame and the last chapter, the film one click away
  if (reduce) {
    ended = true
    root.classList.add('is-end')
    draw(END)
  } else {
    draw(0)
  }
  state()

  /* ── the door: the logo plays its opening, then the scroll zooms through the mark's dot ── */
  if (useDoor && doorCanvas) {
    root.classList.add('has-door', 'door-anim')
    html.classList.add('door-closed')
    // the film waits at its first frame behind the door: load it meanwhile, so it starts at once when the door opens
    // (not on a connection that asks to save data: there it loads when it is let play)
    if (!(navigator as any).connection?.saveData) video.preload = 'auto'
    root.dataset.tone = 'light'
    // the door is this visit's logo moment: the other pages skip their logo loader from now on
    try { sessionStorage.setItem('elia-intro', '1') } catch (e) { /* private mode */ }
    const outline = root.querySelector<SVGGElement>('[data-outline-g]')
    const outlinePath = outline?.querySelector<SVGPathElement>('path')
    const outlineDot = outline?.querySelector<SVGCircleElement>('circle')
    const poster = filmEl.querySelector<HTMLImageElement>('.film__poster img')?.currentSrc || '/film/tannery-start-1600.webp'
    const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
    const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t) }
    const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    // the lockup's box, the mark's, and the dot, in the logo's own units (brand/logo.ts)
    const LOCKUP = { x: 237.9, y: 215.7, w: 366, h: 131.8 }, MARK = { x: 237.9, y: 215.7, w: 146, h: 131.8 }
    const DOTC = { x: 367.52, y: 251.05, r: 10.17 }
    // the opening's own values (gsap moves them), and the scroll's
    const I = { outline: 0, outlineA: 1, start: 0, sweep: 0, dot: 0, dotY: -52, wordX: -70, wordA: 0, filmIn: 0, rim: 0 }
    let p = 0
    let door: Door | null = null
    let queued = 0
    const compose = () => {
      queued = 0
      if (!door) return
      const W = stage.clientWidth, H = stage.clientHeight
      const wide = W > H * 1.05
      const box = wide ? LOCKUP : MARK
      const w0 = wide ? clamp(W * 0.54, 330, 860) : Math.min(W * 0.66, H * 0.34 * (MARK.w / MARK.h))
      const s0 = w0 / box.w
      const s1 = (Math.hypot(W / 2, H / 2) * 1.08) / DOTC.r       // the dot covers the whole screen
      const z = inOut(clamp(p))
      const sc = s0 * Math.pow(s1 / s0, z)
      // where the zoom is centred: the lockup, then the mark alone as the wordmark leaves, then the dot
      const m = wide ? smooth(0, 0.14, p) : 1
      const k = smooth(0.08, 0.5, p)
      const bx = box.x + box.w / 2 + (MARK.x + MARK.w / 2 - (box.x + box.w / 2)) * m, by = box.y + box.h / 2
      const ax = bx + (DOTC.x - bx) * k, ay = by + (DOTC.y - by) * k
      const tx = W / 2 - ax * sc, ty = H * (0.42 + 0.08 * k) - ay * sc
      const exit = smooth(0, 0.14, p)                             // the wordmark goes back behind the e
      Object.assign(door.state, {
        s: sc, tx, ty, sweep: I.sweep, dot: I.dot, dotY: I.dotY,
        // the e gives way as the page goes in, so only the dot opens onto the film (at the dot's scale the e's curve
        // would sweep past the screen's edge)
        eA: 1 - smooth(0.05, 0.3, p),
        wordX: I.wordX - 70 * exit, wordA: wide ? I.wordA * (1 - exit) : 0,
        filmIn: I.filmIn, rim: I.rim * (1 - smooth(0, 0.16, p)), view: 1.18 - 0.18 * smooth(0, 1, p),
        color: smooth(0.06, 0.5, p),
      })
      door.draw()
      if (outline && !root.classList.contains('door-played')) {
        outline.setAttribute('transform', `matrix(${sc} 0 0 ${sc} ${tx} ${ty})`)
        outline.style.opacity = String(I.outlineA * (1 - exit))
        if (outlinePath) outlinePath.style.strokeDashoffset = String(1 - I.outline)
        if (outlineDot) outlineDot.style.transform = `scale(${I.start})`
      }
      root.style.setProperty('--hello', String(1 - smooth(0, 0.18, p)))
    }
    const redraw = () => { if (!queued) queued = requestAnimationFrame(compose) }

    // the logo's opening, as in the brand film, in about two and a half seconds: the outline of Ethiopia, the amber
    // dot at its western point, the e drawn round out of it, the outline gone, the dot dropping in, the wordmark
    // sliding out; then the film comes into the mark in the logo's amber, spreading from the dot
    // the opening, then (after a moment on the name) the way in through the dot, on its own: the page glides the
    // door's distance (the scroller's own animation, so a visitor's wheel or finger simply takes over from it)
    const HOLD = 1.2, GLIDE = 2.8
    let handOver = false, later: gsap.core.Tween | null = null
    const gliding = (on: boolean) => html.classList.toggle('door-gliding', on)   // the header stays (site.ts)
    const goIn = () => {
      later = null
      if (handOver || open || scrollY > 4 || html.classList.contains('menu-open')) return
      const to = root.getBoundingClientRect().top + scrollY + innerHeight * DOOR
      gliding(true)
      const done = () => gsap.delayedCall(0.5, () => gliding(false))
      if (lenis) lenis.scrollTo(to, { duration: GLIDE, easing: (t: number) => t, force: true, onComplete: done })
      else { scrollTo({ top: to, behavior: 'smooth' }); done() }
    }
    // a visitor's own scrolling, tap or key: the glide does not start, or stops where it is
    const takeOver = () => {
      if (handOver) return
      handOver = true
      later?.kill(); later = null
      if (html.classList.contains('door-gliding') && lenis) { lenis.stop(); lenis.start() }
      gliding(false)
      for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) removeEventListener(ev, takeOver)
    }
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) addEventListener(ev, takeOver, { passive: true })
    const intro = gsap.timeline({
      paused: true, onUpdate: redraw,
      onComplete: () => { root.classList.add('door-played'); if (!handOver) later = gsap.delayedCall(HOLD, goIn) },
    })
    intro
      .to(I, { outline: 1, duration: 0.7, ease: 'power2.inOut' }, 0)
      .to(I, { start: 1, duration: 0.28, ease: 'back.out(3)' }, 0.4)
      .to(I, { sweep: 1, duration: 0.62, ease: 'power2.inOut' }, 0.6)
      .to(I, { outlineA: 0, start: 0, duration: 0.4, ease: 'power1.in' }, 0.95)
      .to(I, { dot: 1, duration: 0.16, ease: 'power1.out' }, 1.08)
      .to(I, { dotY: 0, duration: 0.66, ease: 'bounce.out' }, 1.08)
      .to(I, { wordX: 0, wordA: 1, duration: 0.65, ease: 'power3.out' }, 1.25)
      .call(() => root.classList.add('door-in'), [], 1.45)
      .to(I, { filmIn: 1, duration: 0.85, ease: 'power2.inOut' }, 1.6)
      .call(startFilm, [], 1.6)

    mountDoor(doorCanvas, video, poster).then((d) => {
      if (!d) {                                                   // no WebGL here: no door, the film as it is
        useDoor = false; open = true
        startFilm()
        root.classList.add('no-door', 'is-open'); root.classList.remove('door-anim')
        html.classList.remove('door-closed')
        root.dataset.tone = 'dark'; dispatchEvent(new Event('elia-tone'))
        ScrollTrigger.refresh()
        return
      }
      door = d
      door.run(true)
      compose()
      root.dataset.tone = 'light'
      dispatchEvent(new Event('elia-tone'))
      intro.play()
      ScrollTrigger.create({
        start: 0, end: () => innerHeight * DOOR,                 // from the top of the page (the story starts it)
        onUpdate: (st) => {
          p = st.progress
          // someone already scrolling: the opening is over at once
          if (p > 0.015 && intro.progress() < 1) intro.progress(1)
          if (p > 0.015) startFilm()
          const isOpen = p >= 0.985
          if (isOpen !== open) {
            open = isOpen
            root.classList.toggle('is-open', open)
            html.classList.toggle('door-closed', !open)
            door?.run(!open)
            if (open) {
              // the first chapter's pace, from where the film is now: its words stay FIRST_FOR seconds
              const t = video.currentTime || 0
              if (t < chapters[0].t1) FIRST = Math.min(FAST, Math.max(0.45, (chapters[0].t1 - t) / FIRST_FOR))
              draw(t)
            }
            video.dispatchEvent(new Event('elia-sync'))
          }
          const tone = p > 0.6 ? 'dark' : 'light'
          if (root.dataset.tone !== tone) { root.dataset.tone = tone; dispatchEvent(new Event('elia-tone')) }
          redraw()
        },
      })
      addEventListener('resize', redraw)
    })
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
}
