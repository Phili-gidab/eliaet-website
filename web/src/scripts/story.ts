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

  // the clock: the film's time, every frame it shows (rVFC where there is one)
  const tick = () => {
    if (!ended) draw(video.currentTime || 0)
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
