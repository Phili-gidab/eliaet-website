/* ELIA · the script every page loads (small, no libraries): header state, the menu, reveals, counters, forms. */
import { ready, solvePow } from '../lib/pow'

/* ── signed in: "Member login" becomes "My account" (the server's small elia_in cookie: m member, s Secretariat) ── */
{
  const who = /(?:^|;\s*)elia_in=([ms])/.exec(document.cookie)?.[1]
  if (who) {
    document.querySelectorAll<HTMLAnchorElement>('[data-account]').forEach((a) => {
      a.href = who === 's' ? '/admin' : '/members/dashboard'
      const l = a.querySelector('[data-account-label]')
      if (l) l.textContent = who === 's' ? 'Back office' : 'My account'
    })
  }
}

const root = document.documentElement
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── header: solid once the page moves, out of the way while reading down, back when scrolling up ── */
{
  let last = scrollY
  let ticking = false
  const update = () => {
    const y = scrollY
    root.classList.toggle('scrolled', y > 24)
    const down = y > last + 4
    const up = y < last - 4
    // (not while the home page's door is still closed: the page is held there, scrolling only opens it)
    if (down && y > 520 && !root.classList.contains('menu-open') && !root.classList.contains('door-closed')) root.classList.add('hide-hdr')
    else if (up || y < 120) root.classList.remove('hide-hdr')
    last = y
    ticking = false
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }, { passive: true })
  update()
}

/* ── the menu (a <dialog>: focus stays inside, Esc closes) ── */
{
  const dlg = document.querySelector<HTMLDialogElement>('[data-menu]')
  const openers = document.querySelectorAll<HTMLElement>('[data-menu-open]')
  if (dlg) {
    const close = () => {
      if (!dlg.open) return
      if (reduce) { dlg.close(); return }
      dlg.classList.add('closing')
      dlg.addEventListener('animationend', () => { dlg.classList.remove('closing'); dlg.close() }, { once: true })
    }
    openers.forEach((b) => b.addEventListener('click', () => {
      dlg.showModal()
      root.classList.add('menu-open')
      openers.forEach((o) => o.setAttribute('aria-expanded', 'true'))
    }))
    dlg.addEventListener('close', () => {
      root.classList.remove('menu-open')
      openers.forEach((o) => o.setAttribute('aria-expanded', 'false'))
    })
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close() })
    dlg.querySelector('[data-menu-close]')?.addEventListener('click', close)
    dlg.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => dlg.close()))
  }
}

/* ── with less motion a moving row (the partners) stands still and scrolls instead: then it takes keyboard focus,
   so it can be scrolled with the arrow keys ── */
if (reduce) {
  document.querySelectorAll<HTMLElement>('.marquee').forEach((m) => {
    m.tabIndex = 0
    m.setAttribute('role', 'region')
    m.setAttribute('aria-label', m.dataset.label || 'A row that scrolls sideways')
  })
}

/* ── reveals: elements with data-reveal (and .lines headings) fade/rise in once ── */
{
  const els = document.querySelectorAll<HTMLElement>('[data-reveal], .lines')
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('in'))
  } else {
    // a [data-reveal=mask] element starts fully clipped, and Chrome measures it after its clip-path (always 0%
    // visible), so masks go in as soon as they touch the viewport; everything else at 12%
    // anything already scrolled past (a jump to an anchor, a fast fling) goes in at once, so it is there on the way back up
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const mask = (e.target as HTMLElement).dataset.reveal === 'mask'
        const passed = !e.isIntersecting && e.boundingClientRect.bottom <= 0
        if (passed || (e.isIntersecting && (mask || e.intersectionRatio >= 0.12))) { e.target.classList.add('in'); io.unobserve(e.target) }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: [0, 0.12] })
    els.forEach((el) => io.observe(el))
  }
}

/* ── a cover's leather goods in 3D (components/Cover.astro, scripts/cover3d.ts); the still picture where 3D cannot be
   drawn ── */
{
  const gl = document.querySelector<HTMLCanvasElement>('[data-cover-gl]')
  const cover = gl?.closest<HTMLElement>('[data-cover]')
  if (gl && cover) {
    const can = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false } })()
    if (!can) cover.classList.add('no-gl')
    else import('./cover3d').then((m) => m.mountGoods(gl, cover)).then((ok) => { if (!ok) cover.classList.add('no-gl') }).catch(() => cover.classList.add('no-gl'))
  }
}

/* ── leather: a hide's picture loads when its place comes near (styles/leather.css); a spread's photographs too ── */
{
  const els = document.querySelectorAll<HTMLElement>('.hide, .sec--saddle, .window')
  if (!('IntersectionObserver' in window)) els.forEach((el) => el.classList.add('is-near'))
  else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-near'); io.unobserve(e.target) }
    }, { rootMargin: '900px 0px' })
    els.forEach((el) => io.observe(el))
  }
}

/* ── counters: <span data-count="194">194</span> counts up from 0 when it comes into view. The page carries the real
   number (without the script, and for search engines); one already on screen when the page opens just stays put. ── */
{
  const els = document.querySelectorAll<HTMLElement>('[data-count]')
  const run = (el: HTMLElement) => {
    const to = Number(el.dataset.count)
    if (!Number.isFinite(to)) return
    if (reduce) { el.textContent = el.dataset.count!; return }
    const dur = 1600; const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const v = Math.round(to * (1 - Math.pow(1 - k, 4)))
      el.textContent = String(v).padStart(el.dataset.pad ? Number(el.dataset.pad) : 0, '0')
      if (k < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  if (els.length && !reduce) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { run(e.target as HTMLElement); io.unobserve(e.target) }
    }, { threshold: 0.6 })
    els.forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) return
      el.textContent = '0'
      io.observe(el)
    })
  }
}

/* ── forms: <form data-form="general" action="/api/forms/general"> posts to the API, shows the answer in
   [data-form-msg]. The spam check's puzzle starts as soon as someone begins to fill a form in. ── */
{
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-form]')
  forms.forEach((form) => {
    form.addEventListener('focusin', () => ready(), { once: true })
    const msg = form.querySelector<HTMLElement>('[data-form-msg]')
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    const say = (text: string, ok = false) => { if (msg) { msg.textContent = text; msg.dataset.ok = ok ? '1' : '0' } }

    // a field marked invalid is cleared as soon as it is put right
    form.addEventListener('input', (ev) => {
      const el = ev.target as HTMLInputElement
      if (!el.matches?.('input, select, textarea') || !el.checkValidity()) return
      const group = el.type === 'radio' || el.type === 'checkbox' ? form.querySelectorAll(`[name="${CSS.escape(el.name)}"]`) : [el]
      group.forEach((g) => { g.removeAttribute('aria-invalid'); g.closest('label, .field')?.querySelector('.err')?.remove() })
    })

    // a file field says what was picked, and keeps a file of the wrong kind or size from being sent
    form.querySelectorAll<HTMLInputElement>('input[type="file"][data-max-mb]').forEach((input) => {
      const hint = document.getElementById(input.getAttribute('aria-describedby') ?? '')
      const note = hint?.textContent ?? ''
      const max = Number(input.dataset.maxMb) * 1048576
      const types = input.accept.split(',').map((t) => t.trim()).filter((t) => t.includes('/'))
      const check = () => {
        const f = input.files?.[0]
        let bad = ''
        if (f && types.length && !types.includes(f.type)) bad = 'This kind of file is not accepted. ' + note
        else if (f && f.size > max) bad = `This file is ${(f.size / 1048576).toFixed(1)} MB; the limit is ${input.dataset.maxMb} MB.`
        input.setCustomValidity(bad)
        const size = f && (f.size < 1048576 ? `${Math.max(1, Math.round(f.size / 1024))} kB` : `${(f.size / 1048576).toFixed(1)} MB`)
        if (hint) {
          hint.textContent = bad || (f ? `${f.name}, ${size}.` : note)
          hint.classList.toggle('hint--bad', !!bad)
        }
      }
      input.addEventListener('change', check)
      form.addEventListener('reset', () => setTimeout(check))
    })
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'))
      form.querySelectorAll('.err').forEach((e) => e.remove())
      if (!form.checkValidity()) {
        const bad = form.querySelector<HTMLElement>('input:invalid, select:invalid, textarea:invalid')
        bad?.setAttribute('aria-invalid', 'true'); bad?.focus()
        say('Please fill in the highlighted field.')
        return
      }
      const multipart = form.enctype === 'multipart/form-data'
      btn?.setAttribute('disabled', '')
      form.classList.add('sending')
      say('Sending…')
      try {
        const fd = new FormData(form)
        const pow = await solvePow()
        fd.set('pow', pow)
        // several boxes of one name (interests) go as a list
        const obj: Record<string, unknown> = {}
        for (const [k, v] of fd.entries()) {
          if (typeof v !== 'string') continue
          obj[k] = k in obj ? [obj[k]].flat().concat(v) : form.querySelectorAll(`input[type="checkbox"][name="${k}"]`).length > 1 ? [v] : v
        }
        const body = multipart ? fd : JSON.stringify(obj)
        const res = await fetch(form.action, {
          method: 'POST', body,
          // with a file, the spam check also goes as a header, so the server can check it before reading the upload
          headers: multipart ? { Accept: 'application/json', 'X-Pow': pow } : { 'Content-Type': 'application/json', Accept: 'application/json' },
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          form.reset()
          form.classList.add('sent')
          say((form.dataset.ok || 'Thank you. We have received it.') + (data.ref ? ` Your reference: ${data.ref}.` : ''), true)
        } else {
          say(data.error || 'Something went wrong. Please try again.')
          for (const [name, text] of Object.entries<string>(data.fields || {})) {
            const field = form.elements.namedItem(name) as HTMLElement | null
            if (field && 'setAttribute' in field) {
              field.setAttribute('aria-invalid', 'true')
              const e = document.createElement('span'); e.className = 'err'; e.textContent = text
              field.closest('label, .field')?.append(e)
            }
          }
        }
      } catch {
        say('No connection. Please check it and try again, or e-mail info@eliaet.com.')
      } finally {
        btn?.removeAttribute('disabled')
        form.classList.remove('sending')
      }
    })
  })
}


/* ── cards: the light follows the pointer ── */
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
  addEventListener('pointermove', (e) => {
    const card = (e.target as Element | null)?.closest?.('.card') as HTMLElement | null
    if (!card) return
    const r = card.getBoundingClientRect()
    card.style.setProperty('--mx', `${e.clientX - r.left}px`)
    card.style.setProperty('--my', `${e.clientY - r.top}px`)
  }, { passive: true })
}
