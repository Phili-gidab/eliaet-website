/* ELIA · the member directory: sector chips and a name search, filtered in the page (the list is short).
   Reads ?sector=tannery|footwear|leather-goods on load (the footer links there) and keeps the address in step with
   the chosen chip. Without JavaScript the controls stay hidden and every member is listed. */

const root = document.querySelector<HTMLElement>('[data-directory]')

if (root) {
  const cards = [...root.querySelectorAll<HTMLElement>('[data-member]')]
  const chips = [...root.querySelectorAll<HTMLInputElement>('input[name="sector"]')]
  const search = root.querySelector<HTMLInputElement>('input[name="q"]')
  const status = root.querySelector<HTMLElement>('[data-dir-status]')
  const empty = root.querySelector<HTMLElement>('[data-dir-empty]')
  const reset = root.querySelector<HTMLButtonElement>('[data-dir-reset]')
  const sectors = new Set(chips.map((c) => c.value).filter(Boolean))

  // names compare without case, spaces or punctuation, so "shir shir" finds "Shirshir Ethiopia"
  const key = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u1200-\u137f]+/g, '')

  const current = () => chips.find((c) => c.checked)?.value ?? ''

  const apply = () => {
    const sector = current()
    const q = key(search?.value ?? '')
    let shown = 0
    for (const card of cards) {
      const inSector = !sector || (card.dataset.sectors ?? '').split(' ').includes(sector)
      const named = !q || (card.dataset.name ?? '').includes(q)
      card.hidden = !(inSector && named)
      if (!card.hidden) shown++
    }
    if (empty) empty.hidden = shown > 0
    if (status) {
      // with nothing to show, the panel below says so; the line stays for screen readers only
      status.classList.toggle('sr-only', shown === 0)
      const chip = chips.find((c) => c.checked)
      if (shown === 0) status.textContent = 'No members match.'
      else if (q) status.textContent = `${shown} ${shown === 1 ? 'member matches' : 'members match'}.`
      else if (sector && chip) status.textContent = `${shown} of the ${chip.dataset.total} ${chip.dataset.plural} listed so far.`
      else status.textContent = ''
    }
  }

  const syncUrl = () => {
    const url = new URL(location.href)
    const sector = current()
    if (sector) url.searchParams.set('sector', sector)
    else url.searchParams.delete('sector')
    history.replaceState(history.state, '', url)
  }

  // the sector in the address, if it is one we know
  const asked = new URLSearchParams(location.search).get('sector') ?? ''
  const start = sectors.has(asked) ? asked : ''
  chips.forEach((c) => { c.checked = c.value === start })
  if (asked && !start) syncUrl()
  apply()

  // a link straight to one sector (the footer's) lands on the directory, not on the page head
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (start && !location.hash && (!nav || nav.type === 'navigate')) {
    root.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior })
  }

  chips.forEach((c) => c.addEventListener('change', () => { apply(); syncUrl() }))
  search?.addEventListener('input', apply)
  search?.closest('form')?.addEventListener('submit', (e) => e.preventDefault())
  reset?.addEventListener('click', () => {
    chips.forEach((c) => { c.checked = c.value === '' })
    if (search) search.value = ''
    apply()
    syncUrl()
    chips.find((c) => c.value === '')?.focus()
  })
}

export {} // a module, so its top-level names stay its own
