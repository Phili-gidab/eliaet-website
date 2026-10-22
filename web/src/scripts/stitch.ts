/* ELIA · the seam: a line of saddle stitching down the left edge of the home page's sheets, one sheet after another
   at the same place, so it reads as one thread sewn down the whole page (the brand line's journey: from the
   highlands, through the workshop and the fair, to the world). Each sheet's stretch sews itself as the sheet passes:
   a mask uncovers the stitches from the top down with the scroll, a small amber needle at its end. Amber on the
   dark and on cream, brown on amber. Less motion: the seam is simply there. Phones: none (no room at the edge). */
import { gsap, ScrollTrigger, reduce } from './motion'

const NS = 'http://www.w3.org/2000/svg'
const sheets = [...document.querySelectorAll<HTMLElement>('main > section.sec')]
if (sheets.length && matchMedia('(min-width: 640px)').matches) {
  sheets.forEach((sec, i) => {
    const svg = document.createElementNS(NS, 'svg')
    svg.classList.add('thread')
    svg.setAttribute('aria-hidden', 'true')
    const id = `thread-${i}`
    svg.innerHTML =
      `<defs><mask id="${id}" maskUnits="userSpaceOnUse"><path class="thread__reveal" pathLength="1"/></mask></defs>` +
      `<path class="thread__hole" mask="url(#${id})"/><path class="thread__line" mask="url(#${id})"/><circle class="thread__needle" r="3.2"/>`
    sec.append(svg)
    const reveal = svg.querySelector<SVGPathElement>('.thread__reveal')!
    const thread = svg.querySelector<SVGPathElement>('.thread__line')!
    const hole = svg.querySelector<SVGPathElement>('.thread__hole')!
    const needle = svg.querySelector<SVGCircleElement>('.thread__needle')!

    // the seam's course: down the sheet, from under its rounded corner to its foot, wandering a hair as a hand's does
    let len = 0
    const build = () => {
      const h = sec.offsetHeight
      const top = parseFloat(getComputedStyle(sec).getPropertyValue('--radius-l')) || 36
      svg.setAttribute('viewBox', `0 0 24 ${h}`)
      svg.setAttribute('height', String(h))
      let d = `M12 ${top + 10}`
      for (let y = top + 10; y < h; y += 90) {
        const y1 = Math.min(h, y + 90), x = 12 + Math.sin((y + i * 140) / 260) * 1.6
        d += ` Q${(12 + x) / 2} ${y + 45} ${x} ${y1}`
      }
      for (const p of [reveal, thread, hole]) p.setAttribute('d', d)
      len = thread.getTotalLength()
    }
    build()
    new ResizeObserver(build).observe(sec)

    const draw = (p: number) => {
      reveal.style.strokeDashoffset = String(1 - p)
      const pt = thread.getPointAtLength(len * p)
      needle.setAttribute('cx', String(pt.x)); needle.setAttribute('cy', String(pt.y))
      needle.style.opacity = p > 0.002 && p < 0.998 ? '1' : '0'
    }
    if (reduce) { draw(1); return }
    draw(0)
    // sewn as the sheet goes by: from its top coming up the screen to its foot reaching the screen's foot
    ScrollTrigger.create({ trigger: sec, start: 'top 85%', end: 'bottom bottom', scrub: 0.6, onUpdate: (st) => draw(st.progress) })
  })
  // (the sheets above change height as their pictures and fonts arrive)
  gsap.delayedCall(1.2, () => ScrollTrigger.refresh())
}
