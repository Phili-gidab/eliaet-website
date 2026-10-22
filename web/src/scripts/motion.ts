/* ELIA · motion on the public pages. The wheel glides (Lenis), and GSAP's ScrollTrigger ties a few effects to the
   scroll, the way a camera would move: windows onto a still photograph (data-window), pictures that drift
   (data-parallax), rows that keep moving and quicken with the scroll (data-marquee). The header takes the tone of
   whatever it is over (data-tone), with or without motion.
   People who ask for less motion get none of it: native scrolling, still pictures, still rows that scroll sideways. */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)
export { gsap, ScrollTrigger }
export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
const root = document.documentElement

/* ── smooth scrolling: the wheel glides; touch, keys and the scrollbar stay native ── */
export const lenis = reduce ? null : new Lenis({ lerp: 0.1, smoothWheel: true })
if (lenis) {
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((t) => lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
  // the menu (a modal dialog) holds the page still while it is open
  new MutationObserver(() => (root.classList.contains('menu-open') ? lenis.stop() : lenis.start()))
    .observe(root, { attributes: true, attributeFilter: ['class'] })
}

/* ── the header's tone: light glass over the light sections, dark glass over the dark ones ── */
{
  const probeY = 40
  let ticking = false
  const tone = () => {
    let t = 'dark'
    // the last section (in page order) that runs under the header wins, so a section inside another one counts
    document.querySelectorAll<HTMLElement>('[data-tone]').forEach((s) => {
      const r = s.getBoundingClientRect()
      if (r.top <= probeY && r.bottom > probeY && r.height > 0) t = s.dataset.tone || 'dark'
    })
    if (root.dataset.hdr !== t) root.dataset.hdr = t
    ticking = false
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tone) } }, { passive: true })
  addEventListener('resize', tone)
  addEventListener('elia-tone', tone)
  tone()
}

if (!reduce) {
  /* ── windows: the photograph stays put; it settles from a slight zoom as the window passes, and the words
     slide across it the other way ── */
  gsap.utils.toArray<HTMLElement>('[data-window]').forEach((w) => {
    const img = w.querySelector<HTMLImageElement>('.window__pic img')
    const words = w.querySelectorAll<HTMLElement>('[data-window-line]')
    // the picture is decoded a little before its window arrives, so it is there on the first frame
    if (img) ScrollTrigger.create({ trigger: w, start: 'top bottom+=120%', once: true, onEnter: () => { img.decode?.().catch(() => {}) } })
    const tl = gsap.timeline({ scrollTrigger: { trigger: w, start: 'top bottom', end: 'bottom top', scrub: true } })
    if (img) tl.fromTo(img, { scale: 1.16 }, { scale: 1, ease: 'none' }, 0)
    words.forEach((el, i) => {
      const dir = i % 2 ? 1 : -1
      tl.fromTo(el, { xPercent: -dir * 9 }, { xPercent: dir * 9, ease: 'none' }, 0)
    })
    const note = w.querySelector('.window__note')
    if (note) tl.fromTo(note, { y: 60, autoAlpha: 0 }, { y: -20, autoAlpha: 1, ease: 'power1.out', duration: 0.35 }, 0.3)
  })

  /* ── pictures that drift inside their frames (the frame clips them): data-parallax="12" moves them 12% ── */
  gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
    const d = parseFloat(el.dataset.parallax || '10')
    gsap.fromTo(el, { yPercent: -d, scale: 1 + d / 50 }, {
      yPercent: d, scale: 1 + d / 50, ease: 'none',
      scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
    })
  })

  /* ── pictures that open as they come in: a clip from the bottom, the picture settling inside it ── */
  gsap.utils.toArray<HTMLElement>('[data-open]').forEach((el) => {
    const img = el.querySelector('img')
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
    tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0% round var(--radius))' }, { clipPath: 'inset(0% 0% 0% 0% round var(--radius))', duration: 1.25, ease: 'expo.out', delay: parseFloat(el.dataset.open || '0') })
    if (img) tl.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.6, ease: 'expo.out' }, '<')
  })

  /* ── rows that keep moving: they run on their own, quicken with the scroll and turn with its direction ── */
  gsap.utils.toArray<HTMLElement>('[data-marquee]').forEach((m) => {
    const tracks = m.querySelectorAll<HTMLElement>('.marquee__track')
    if (!tracks.length) return
    m.classList.add('is-js')
    const base = (m.dataset.marquee === 'right' ? 1 : -1) * (parseFloat(m.dataset.speed || '40'))   // px a second
    let x = 0, boost = 0, dir = 1, on = false, hover = false
    const width = () => tracks[0].offsetWidth
    const wrap = (v: number) => { const w = width(); return w ? ((v % w) - w) % w : 0 }
    ScrollTrigger.create({
      trigger: m, start: 'top bottom', end: 'bottom top',
      onToggle: (s) => { on = s.isActive },
      onUpdate: (s) => { dir = s.direction; boost = Math.min(8, Math.abs(s.getVelocity()) / 220) },
    })
    m.addEventListener('pointerenter', () => { hover = true })
    m.addEventListener('pointerleave', () => { hover = false })
    gsap.ticker.add((_t, dt) => {
      if (!on) return
      boost *= 0.92
      const speed = hover ? 0.15 : 1 + boost
      x = wrap(x + base * dir * speed * (dt / 1000))
      tracks.forEach((t) => { t.style.transform = `translate3d(${x.toFixed(2)}px,0,0)` })
    })
  })

  // sizes change once the fonts and pictures are in
  document.fonts?.ready.then(() => ScrollTrigger.refresh())
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true })
}
