/* ELIA · the 3D stage, the part every visitor gets (no libraries): the pieces' pictures and the buttons that choose
   between them. When the stage comes near and the browser can draw 3D, it loads stage3d-gl.ts (three.js, about
   180 kB) and the chosen piece's model, and the model takes over from its picture. On a connection that asks to
   save data, or a slow one, the model loads only when someone asks for it ("Turn it in 3D"). */
import type { Piece } from './stage3d-gl'

interface Config extends Piece { name: string; note: string }

const webgl = (() => {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
})()
const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
const frugal = !!conn && (conn.saveData === true || /(^|-)2g$|3g/.test(conn.effectiveType || ''))

for (const root of document.querySelectorAll<HTMLElement>('[data-s3d]')) {
  const pieces: Config[] = JSON.parse(root.dataset.pieces || '[]')
  const posters = [...root.querySelectorAll<HTMLElement>('[data-poster]')]
  const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-piece]')]
  const note = root.querySelector<HTMLElement>('[data-note]')
  const ask = root.querySelector<HTMLButtonElement>('[data-s3d-load]')
  let current = pieces[0]
  let stage: import('./stage3d-gl').Stage | null = null
  let starting: Promise<void> | null = null

  const choose = async (key: string) => {
    const p = pieces.find((x) => x.key === key)
    if (!p) return
    current = p
    for (const t of tabs) t.setAttribute('aria-pressed', String(t.dataset.piece === key))
    if (note) note.textContent = p.note
    for (const im of posters) im.classList.toggle('is-on', im.dataset.poster === key)
    if (stage) {
      root.classList.add('is-loading')
      try {
        await stage.show(p)
      } finally {
        if (current === p) root.classList.remove('is-loading')
      }
    }
  }
  tabs.forEach((t) => t.addEventListener('click', () => choose(t.dataset.piece!)))

  const start = () => {
    if (starting || !webgl) return starting
    root.classList.add('is-loading')
    starting = import('./stage3d-gl')
      .then(async ({ Stage }) => {
        stage = new Stage(root)
        await stage.show(current)
        root.classList.add('is-live')
        if (ask) ask.hidden = true
      })
      .catch(() => {
        root.classList.add('is-failed')        // the pictures stay
      })
      .finally(() => root.classList.remove('is-loading'))
    return starting
  }

  if (!webgl) continue
  root.classList.add('can-3d')
  if (frugal) {
    if (ask) { ask.hidden = false; ask.addEventListener('click', () => start(), { once: true }) }
    continue
  }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { io.disconnect(); start() }
  }, { rootMargin: '400px 0px' })
  io.observe(root)
}
