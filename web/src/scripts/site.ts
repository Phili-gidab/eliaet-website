/* ELIA · the script every page loads (small, no libraries): header state, the menu, reveals, counters, forms. */

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
    if (down && y > 520 && !root.classList.contains('menu-open')) root.classList.add('hide-hdr')
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

/* ── counters: <span data-count="194">0</span> counts up when seen ── */
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
  if (els.length) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { run(e.target as HTMLElement); io.unobserve(e.target) }
    }, { threshold: 0.6 })
    els.forEach((el) => io.observe(el))
  }
}

/* ── forms: <form data-form="contact" action="/api/contact"> posts to the API, shows the answer in [data-form-msg] ── */
{
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-form]')
  forms.forEach((form) => {
    const msg = form.querySelector<HTMLElement>('[data-form-msg]')
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    const say = (text: string, ok = false) => { if (msg) { msg.textContent = text; msg.dataset.ok = ok ? '1' : '0' } }
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
      const fd = new FormData(form)
      const body = multipart ? fd : JSON.stringify(Object.fromEntries(fd.entries()))
      btn?.setAttribute('disabled', '')
      form.classList.add('sending')
      say('Sending…')
      try {
        const res = await fetch(form.action, {
          method: 'POST', body,
          headers: multipart ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          form.reset()
          form.classList.add('sent')
          say(form.dataset.ok || 'Thank you. We have received it.', true)
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

export {} // a module, so its top-level names stay its own

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
