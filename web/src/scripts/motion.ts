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
export const lenis = reduce ? null : new Lenis({ lerp: 0.1, smoothWheel: true, anchors: true })
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

/* ── sheets: each section is laid on the one before it. Its label goes up into a tab at its top edge (or its
   data-tab names it); with motion, the one before holds still while the next slides up over it, and sinks back ── */
{
  const main = document.querySelector('main')
  if (main) {
    const kids = [...main.children] as HTMLElement[]
    // the home page's story is one too: its film is held while the next section slides over it
    const sheets = kids.filter((el) => el.matches('section.sec, section.window, section.ph, section.cover, section.story'))
    for (const sec of sheets) {
      if (sec.matches('.ph, .window, .cover, .story') || sec.querySelector(':scope > .sheet-tab')) continue
      const named = sec.dataset.tab
      const label = named ? null : sec.querySelector<HTMLElement>(':scope > .wrap .label--rule')
      if (!named && !label) continue
      // a label that is the section's heading stays its heading in the tab (its level, and the id that names the section)
      const tab = document.createElement(label && /^H[2-6]$/.test(label.tagName) ? label.tagName.toLowerCase() : 'p')
      tab.className = 'sheet-tab'
      if (label) { tab.innerHTML = label.innerHTML; if (label.id) tab.id = label.id; label.remove() } else tab.textContent = named!
      sec.prepend(tab)
    }
    if (!reduce) {
      kids.forEach((el, i) => { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.style.zIndex = String(i + 1) })
      const ro = new ResizeObserver((entries) => {
        for (const e of entries) (e.target as HTMLElement).style.setProperty('--sheet-h', `${(e.target as HTMLElement).offsetHeight}px`)
      })
      for (const sec of sheets) {
        const next = sec.nextElementSibling as HTMLElement | null
        // a window slides up over the sheet before it, but is not held: it goes on up, so that its frame and its
        // picture keep moving apart
        if (!next || sec.matches('.window')) continue
        sec.classList.add('is-stacked')
        sec.style.setProperty('--sheet-h', `${sec.offsetHeight}px`)
        ro.observe(sec)
        const shade = document.createElement('div')
        shade.className = 'sheet-shade'
        sec.append(shade)
        // where the next one starts, in the page's flow (the sheet itself is held while it is covered)
        const mark = document.createElement('div')
        mark.className = 'sheet-mark'
        mark.setAttribute('aria-hidden', 'true')
        sec.after(mark)
        ScrollTrigger.create({
          trigger: mark, start: 'top bottom', end: 'top top', scrub: true,
          onUpdate: (st) => sec.style.setProperty('--cover', st.progress.toFixed(3)),
          // while it shrinks it is drawn once and scaled as a picture, so its type does not shimmer
          onToggle: (st) => { sec.style.willChange = st.isActive ? 'transform' : '' },
        })
        // once the next one has covered it (and gone a little further), it is not drawn at all, and whatever moves
        // in it (a film, a 3D piece) is told to rest: a held section stays on screen, under the others, to the end
        ScrollTrigger.create({
          trigger: mark, start: 'top -120', end: 'max',
          onToggle: (st) => {
            sec.classList.toggle('is-covered', st.isActive)
            sec.dispatchEvent(new CustomEvent('sheet-covered', { detail: st.isActive }))
          },
        })
      }
    }
  }
}

if (!reduce) {
  /* ── spreads (components/Window.astro): the page goes up over a scene fixed to the screen. The photograph and its
     cut-out subject drift down together through their margin while the page passes; the headline, between them,
     rises a little, so the three planes part; on the way out its lines part sideways. As the page comes in, its type
     is set: the lines rise out of their masks, the light line opens its spacing, the running head's rule draws, the
     standfirst comes up and the caption is uncovered; scrolling back above the page sets it all back ── */
  gsap.utils.toArray<HTMLElement>('[data-window]').forEach((w) => {
    const imgs = w.querySelectorAll<HTMLImageElement>('.window__pic img, .window__cut img')
    const words = w.querySelector<HTMLElement>('.window__words')
    const lines = w.querySelectorAll<HTMLElement>('.window__words .ln')
    // the pictures are decoded a little before the page arrives, so they are there on its first frame
    ScrollTrigger.create({ trigger: w, start: 'top bottom+=120%', once: true, onEnter: () => imgs.forEach((i) => i.decode?.().catch(() => {})) })
    const tl = gsap.timeline({ scrollTrigger: { trigger: w, start: 'top bottom', end: 'bottom top', scrub: true } })
    tl.fromTo(imgs, { yPercent: -10 }, { yPercent: 10, ease: 'none', duration: 1 }, 0)
    if (words) tl.fromTo(words, { y: () => innerHeight * 0.07 }, { y: () => -innerHeight * 0.07, ease: 'none', duration: 1 }, 0)
    lines.forEach((el, i) => tl.fromTo(el, { xPercent: 0 }, { xPercent: (i % 2 ? 1 : -1) * 4, ease: 'power1.in', duration: 0.42 }, 0.58))

    const set = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
    set.fromTo(w.querySelectorAll('.window__words .ln__in'), { yPercent: 112, rotate: 2.5 }, { yPercent: 0, rotate: 0, duration: 1.25, stagger: 0.1 }, 0)
    set.fromTo(w.querySelectorAll('.window__words .ln--soft .ln__in'), { letterSpacing: '0.3em' }, { letterSpacing: '-0.03em', duration: 1.6, ease: 'power3.out' }, 0)
    set.fromTo(w.querySelector('.window__rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'power3.inOut' }, 0.05)
    set.fromTo(w.querySelectorAll('.window__run > span'), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.07 }, 0.12)
    set.fromTo(w.querySelector('.window__note'), { y: 34, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1 }, 0.38)
    set.fromTo(w.querySelector('.window__cap'), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power3.inOut' }, 0.5)
    ScrollTrigger.create({ trigger: w, start: 'top 58%', onEnter: () => set.play(), onLeaveBack: () => set.reverse() })
  })

  /* ── pictures that drift inside their frames (the frame clips them): data-parallax="12" moves them 12% ── */
  gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
    const d = parseFloat(el.dataset.parallax || '10')
    gsap.fromTo(el, { yPercent: -d, scale: 1 + d / 50 }, {
      yPercent: d, scale: 1 + d / 50, ease: 'none',
      scrollTrigger: { trigger: el.parentElement || el, start: 'top bottom', end: 'bottom top', scrub: true },
    })
  })

  /* ── a cover (components/Cover.astro): as the page goes on, the title sinks back and the subject rises, so they
     part as the next section comes over them ── */
  gsap.utils.toArray<HTMLElement>('[data-cover]').forEach((c) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: c, start: 'top top', end: 'bottom top', scrub: true } })
    const title = c.querySelector('.cover__title'), cut = c.querySelector('.cover__cut')
    if (title) tl.fromTo(title, { y: 0 }, { y: () => innerHeight * 0.16, ease: 'none' }, 0)
    if (cut) tl.fromTo(cut, { yPercent: 0 }, { yPercent: -7, ease: 'none' }, 0)
  })

  /* ── the picture at the top of a page lags behind the scroll inside its frame, as the page goes up over it ── */
  gsap.utils.toArray<HTMLElement>('.ph__media > img').forEach((img) => {
    gsap.fromTo(img, { yPercent: 0, scale: 1.2 }, {
      yPercent: 10, scale: 1.2, ease: 'none',
      scrollTrigger: { trigger: img.parentElement!, start: 0, end: 'bottom top', scrub: true },
    })
  })

  /* ── pictures that open as they come in: a clip from the bottom, the picture settling inside it ── */
  gsap.utils.toArray<HTMLElement>('[data-open]').forEach((el) => {
    const img = el.querySelector('img')
    // (what sits on the picture, a card's arrow, comes with it: the parent is marked open as it starts)
    const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true }, onStart: () => el.parentElement?.classList.add('is-open') })
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
