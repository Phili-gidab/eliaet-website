/* A little Markdown for what the Secretariat writes in the back office (posts, events, notices): paragraphs,
   headings (## and ###), lists (- or 1.), quotes (>), **bold**, *italic* and [links](https://…). Everything is
   escaped first, so no HTML typed into a post ever reaches a page; links go only to web, mail and site addresses. */

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function safeHref(u: string): string | null {
  const s = u.trim()
  if (/^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(s) && !/[\s<>"']/.test(s)) return s
  if (/^www\./i.test(s)) return 'https://' + s
  return null
}

function inline(text: string): string {
  // links first (their text may hold bold or italic), on the escaped text
  let s = esc(text)
  s = s.replace(/\[([^\]]{1,300})\]\(([^)\s]{1,500})\)/g, (_m, label: string, href: string) => {
    const h = safeHref(href.replace(/&amp;/g, '&'))
    if (!h) return label
    const ext = /^https?:\/\//i.test(h)
    return `<a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`
  })
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
  return s
}

export function markdown(src: string): string {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  let list: { tag: 'ul' | 'ol'; items: string[] } | null = null
  let quote: string[] = []
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = [] } }
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null } }
  const flushQuote = () => { if (quote.length) { out.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`); quote = [] } }
  const flush = () => { flushPara(); flushList(); flushQuote() }
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    let m: RegExpMatchArray | null
    if (!line.trim()) { flush(); continue }
    if ((m = line.match(/^(#{2,3})\s+(.+)$/))) { flush(); const t = m[1].length === 2 ? 'h2' : 'h3'; out.push(`<${t}>${inline(m[2])}</${t}>`); continue }
    if ((m = line.match(/^\s*[-*]\s+(.+)$/))) {
      flushPara(); flushQuote()
      if (list?.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] } }
      list.items.push(m[1]); continue
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
      flushPara(); flushQuote()
      if (list?.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] } }
      list.items.push(m[1]); continue
    }
    if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); quote.push(m[1]); continue }
    flushList(); flushQuote()
    para.push(line.trim())
  }
  flush()
  return out.join('\n')
}

/** The text of some Markdown, for a summary or a meta description. */
export function plain(src: string, max = 200): string {
  const s = String(src ?? '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s
}
