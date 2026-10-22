// End-to-end check of the API against a running server: node test/smoke.mjs http://127.0.0.1:4200 <data dir>
// Walks the forms, the Secretariat's sign-up (CLI link), access requests, the directory, profile changes and the
// content types, and the guards (origin, CSRF, roles, lockout). Prints one line per step; exits 1 on the first failure.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const [BASE, DATA] = process.argv.slice(2)
const ORIGIN = new URL(BASE).origin
let step = 0
const ok = (msg) => console.log(`  ok ${String(++step).padStart(2)} ${msg}`)
const fail = (msg, extra) => { console.error(`FAIL ${msg}`, extra ?? ''); process.exit(1) }
const expect = (cond, msg, extra) => (cond ? ok(msg) : fail(msg, extra))

class Client {
  constructor() { this.cookie = ''; this.csrf = '' }
  async req(method, p, body, { origin = ORIGIN, csrf = true, form = false, headers = {} } = {}) {
    const h = { Accept: 'application/json', ...headers }
    if (origin) h.Origin = origin
    if (this.cookie) h.Cookie = this.cookie
    if (csrf && this.csrf) h['X-CSRF'] = this.csrf
    let b
    if (form) b = body
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body) }
    const r = await fetch(BASE + p, { method, headers: h, body: b, redirect: 'manual' })
    const set = r.headers.getSetCookie?.() ?? []
    for (const c of set) {
      const [kv] = c.split(';'); const [k, v] = kv.split('=')
      // the session cookie (the hint cookie beside it, elia_in, opens nothing)
      if (k.includes('elia') && k !== 'elia_in') this.cookie = v ? `${k}=${v}` : ''
    }
    const t = await r.text()
    let j = null; try { j = JSON.parse(t) } catch {}
    return { status: r.status, json: j, text: t, headers: r.headers }
  }
  async session() { const r = await this.req('GET', '/api/auth/session'); this.csrf = r.json?.csrf ?? ''; return r.json }
}

async function pow() {
  const c = await (await fetch(BASE + '/api/pow')).json()
  for (let n = 0; ; n++) {
    const h = crypto.createHash('sha256').update(c.salt + n).digest()
    let z = 0
    for (const b of h) { if (b === 0) { z += 8; continue } z += Math.clz32(b) - 24; break }
    if (z >= c.bits) return `${c.id}.${c.salt}.${c.bits}.${c.expires}.${c.sig}.${n}`
  }
}

const outbox = () => {
  const d = path.join(DATA, 'outbox')
  return fs.existsSync(d) ? fs.readdirSync(d).sort().map((f) => fs.readFileSync(path.join(d, f), 'utf8')) : []
}
const lastLink = (to) => {
  const m = outbox().reverse().find((t) => t.startsWith(`To: ${to}`) && /\/members\/password\?token=/.test(t))
  return m && /\/members\/password\?token=([\w-]+)/.exec(m)[1]
}

const anon = new Client()

// ---- forms
let r = await anon.req('POST', '/api/forms/general', { name: 'Abebe Test', email: 'abebe@example.com', subject: 'Hello', message: 'A question about http://phish.example', pow: await pow() })
expect(r.status === 201 && /^ELIA-/.test(r.json?.ref), 'general inquiry accepted with a reference', r.json)
r = await anon.req('POST', '/api/forms/general', { name: 'X', email: 'x@example.com', subject: 'S', message: 'M' })
expect(r.status === 400, 'a form without the solved puzzle is refused', r.json)
r = await anon.req('POST', '/api/forms/general', { name: 'X', email: 'x@example.com', subject: 'S', message: 'M', pow: 'a.b.15.1.sig.1' })
expect(r.status === 400, 'a forged puzzle is refused')
const reuse = await pow()
r = await anon.req('POST', '/api/forms/media', { name: 'Reporter', outlet: 'Addis Fortune', email: 'r@example.com', request: 'Interview', pow: reuse })
expect(r.status === 201, 'media inquiry accepted', r.json)
r = await anon.req('POST', '/api/forms/media', { name: 'Reporter', outlet: 'Addis Fortune', email: 'r@example.com', request: 'Interview', pow: reuse })
expect(r.status === 400, 'a puzzle solution cannot be used twice')
r = await anon.req('POST', '/api/forms/buyer', { company: 'Buyer GmbH', name: 'Anna', country: 'Germany', email: 'anna@example.com', product: 'Gloves', delivery: '2027-03-01', pow: await pow() })
expect(r.status === 201, 'buyer inquiry accepted', r.json)
r = await anon.req('POST', '/api/forms/investor', { company: 'Inv Ltd', name: 'Raj', country: 'India', email: 'raj@example.com', area: 'Tannery', pow: await pow() })
expect(r.status === 201, 'investor inquiry accepted', r.json)
r = await anon.req('POST', '/api/forms/aalf', { company: 'Chem Co', name: 'Li', email: 'li@example.com', interest: 'Exhibit', booth: '9 m²', pow: await pow() })
expect(r.status === 201, 'AALF inquiry accepted', r.json)
r = await anon.req('POST', '/api/forms/buyer', { company: '', email: 'not-an-email', pow: await pow() })
expect(r.status === 422 && r.json?.fields?.email && r.json?.fields?.company, 'a buyer inquiry with gaps names the fields', r.json)
r = await anon.req('POST', '/api/forms/subscribe', { email: 'news@example.com', interests: ['Buyer', 'Media'], pow: await pow() })
expect(r.status === 201, 'newsletter sign-up', r.json)
r = await anon.req('POST', '/api/forms/general', { name: 'Bot', email: 'b@example.com', subject: 'S', message: 'M', website_url: 'http://spam', pow: 'x' })
expect(r.status === 201, 'a bot filling the hidden field gets a quiet "ok"')
r = await anon.req('POST', '/api/forms/general', { name: 'X', email: 'x@example.com', subject: 'S', message: 'M', pow: await pow() }, { origin: 'https://evil.example' })
expect(r.status === 403, 'a post from another site is refused')

// membership application with a licence
const fd = new FormData()
for (const [k, v] of Object.entries({ companyName: 'Habesha Hides PLC', contactName: 'Sara Kebede', position: 'Manager', phone: '+251 911 000 000', email: 'sara@habeshahides.example',
  category: 'tannery', size: 'medium', region: 'oromia', address: 'Modjo', products: 'Crust and finished sheep leather', yearEstablished: '2012', employees: '120', exportMarkets: 'Italy, China', consent: 'true', pow: await pow() })) fd.append(k, v)
fd.append('licence', new Blob([Buffer.from('%PDF-1.4\n% test licence\n')], { type: 'application/pdf' }), 'licence.pdf')
r = await anon.req('POST', '/api/forms/membership', fd, { form: true })
expect(r.status === 400, 'an application without the spam check in its header is not read', r.json)
r = await anon.req('POST', '/api/forms/membership', fd, { form: true, headers: { 'X-Pow': await pow() } })
expect(r.status === 201, 'membership application with a licence', r.json)
{
  const mine = outbox().filter((t) => t.startsWith('To: abebe@example.com'))
  expect(mine.length === 1 && !mine[0].includes('phish.example') && !mine[0].includes('Abebe'), 'the confirmation repeats nothing that was typed in', mine[0])
}
const fd2 = new FormData()
for (const [k, v] of Object.entries({ companyName: 'Bad File PLC', contactName: 'X', phone: '1', email: 'x@bad.example', category: 'tannery', size: 'small', region: 'oromia', address: 'A', products: 'P', yearEstablished: '2010', consent: 'true', pow: await pow() })) fd2.append(k, v)
fd2.append('licence', new Blob([Buffer.from('<html><script>alert(1)</script>')], { type: 'application/pdf' }), 'licence.pdf')
r = await anon.req('POST', '/api/forms/membership', fd2, { form: true, headers: { 'X-Pow': await pow() } })
expect(r.status === 422 && r.json?.fields?.licence, 'a disguised HTML "PDF" is refused', r.json)
r = await anon.req('POST', '/api/forms/constructor', { pow: await pow() })
expect(r.status === 404, 'a form name that is not a form is a 404 (not an error)', r.json)

// ---- access request (matches a seeded member)
r = await anon.req('POST', '/api/auth/request-access', { companyName: 'Kinaff Leather', name: 'Hana Tadesse', position: 'Export manager', email: 'hana@kinaff.example', phone: '0911', pow: await pow() })
expect(r.status === 201, 'access request sent', r.json)

// ---- the Secretariat's first account, from the command line
const cliOut = execFileSync('node', ['dist/cli.mjs', 'create-admin', 'admin@eliaet.example', 'Secretariat Tester', '--print-link'], { env: { ...process.env, DATA_DIR: DATA, SITE_URL: BASE }, encoding: 'utf8' })
const token = /token=([\w-]+)/.exec(cliOut)?.[1]
expect(!!token, 'create-admin prints a set-password link', cliOut)
const sec = new Client()
r = await sec.req('GET', `/api/auth/token?token=${token}`)
expect(r.json?.ok && r.json.kind === 'set_password', 'the link is valid', r.json)
r = await sec.req('POST', '/api/auth/password', { token, password: 'short' })
expect(r.status === 422, 'a short password is refused')
r = await sec.req('POST', '/api/auth/password', { token, password: 'Leather-Highlands-2026' })
expect(r.status === 200 && r.json?.user?.role === 'secretariat', 'password set; signed in', r.json)
r = await sec.req('POST', '/api/auth/password', { token, password: 'Leather-Highlands-2026' })
expect(r.status === 400, 'the link works only once')
await sec.session()
r = await sec.req('GET', '/api/admin/overview')
expect(r.status === 200 && r.json.access >= 1 && r.json.applications >= 1 && r.json.inquiries >= 5, 'overview counts what came in', { access: r.json?.access, applications: r.json?.applications, inquiries: r.json?.inquiries })
r = await sec.req('POST', '/api/admin/posts', { title: 'x', date: '2026-10-21', category: 'announcements', status: 'draft' }, { csrf: false })
expect(r.status === 403, 'a change without the CSRF token is refused')

// approve the access request
r = await sec.req('GET', '/api/admin/access')
const reqRow = r.json.items.find((x) => x.email === 'hana@kinaff.example')
expect(reqRow && reqRow.company_id, 'the request was matched to Kinaff Leather', reqRow)
r = await sec.req('POST', `/api/admin/access/${reqRow.id}/approve`, { company_id: reqRow.company_id })
expect(r.status === 200, 'access approved', r.json)
const memberToken = lastLink('hana@kinaff.example')
expect(!!memberToken, 'the member was e-mailed a set-password link')
const mem = new Client()
r = await mem.req('POST', '/api/auth/password', { token: memberToken, password: 'Kinaff-Sheepskin-77' })
expect(r.status === 200 && r.json.user.company?.name === 'Kinaff Leather', 'member set a password and is signed in', r.json)
await mem.session()

// ---- the directory
r = await mem.req('GET', '/api/member/directory')
expect(r.status === 200 && r.json.total >= 15 && r.json.items[0].name, `directory lists ${r.json?.total} members A to Z`)
r = await mem.req('GET', '/api/member/directory?cert=EHL')
expect(r.json.total >= 4 && r.json.items.every((c) => c.certifications.includes('EHL')), `EHL filter: ${r.json.total}`)
r = await mem.req('GET', '/api/member/directory?category=tannery&region=amhara')
expect(r.json.items.every((c) => c.category === 'tannery'), `tannery + Amhara filter: ${r.json.total}`)
r = await mem.req('GET', '/api/member/directory?q=kinaff')
expect(r.json.total === 1, 'search by name')
r = await mem.req('GET', '/api/member/directory/kinaff-leather')
expect(r.status === 200 && r.json.company.name === 'Kinaff Leather' && r.json.company.status === undefined, 'a member profile (without the Secretariat-only fields)')
r = await anon.req('GET', '/api/member/directory')
expect(r.status === 401, 'the directory needs a sign-in')
r = await mem.req('GET', '/api/admin/overview')
expect(r.status === 403, 'a member cannot open the back office')

// ---- a profile change, reviewed
const ch = new FormData()
for (const [k, v] of Object.entries({ name: 'Kinaff Leather', products: 'Bags, wallets and belts in Ethiopian sheep leather', export_status: 'exporting', export_markets: 'Japan, Germany', city: 'Addis Ababa', region: 'addis_ababa', certifications: 'EHL' })) ch.append(k, v)
r = await mem.req('POST', '/api/member/me/company', ch, { form: true })
expect(r.status === 201 && r.json.fields.includes('products'), 'member proposed changes', r.json)
r = await mem.req('GET', '/api/member/directory/kinaff-leather')
expect(!r.json.company.products, 'the change does not show before review')
r = await sec.req('GET', '/api/admin/changes')
const chg = r.json.items[0]
r = await sec.req('GET', `/api/admin/changes/${chg.id}`)
expect(r.json.rows.some((x) => x.field === 'products'), 'the Secretariat sees before and after')
r = await sec.req('POST', `/api/admin/changes/${chg.id}/approve`, {})
expect(r.status === 200, 'change approved')
r = await mem.req('GET', '/api/member/directory/kinaff-leather')
expect(/sheep leather/.test(r.json.company.products) && r.json.company.exportLabel === 'Currently exporting', 'the approved change shows in the directory')

// ---- accept the application
r = await sec.req('GET', '/api/admin/applications')
const app = r.json.items.find((a) => a.company_name === 'Habesha Hides PLC')
r = await sec.req('GET', `/api/admin/applications/${app.id}`)
expect(r.json.licence && r.json.licence.mime === 'application/pdf', 'the application has its licence')
const lic = await sec.req('GET', r.json.licence.url)
expect(lic.status === 200 && lic.text.startsWith('%PDF'), 'the Secretariat can open the licence')
const licAnon = await anon.req('GET', r.json.licence.url)
expect(licAnon.status === 302, 'a visitor cannot (sent to sign in)')
const licMem = await mem.req('GET', r.json.licence.url)
expect(licMem.status === 403, 'nor can another member')
r = await sec.req('POST', `/api/admin/applications/${app.id}/accept`, { invite: true })
expect(r.status === 200 && r.json.companyId && r.json.userId, 'application accepted: company made, contact invited', r.json)
expect(!!lastLink('sara@habeshahides.example'), 'the new member was e-mailed their link')

// ---- content
r = await sec.req('POST', '/api/admin/posts', { title: 'ELIA welcomes new members', date: '2026-10-21', category: 'announcements', summary: 'Three companies joined.', body: 'Hello **members**.\n\n- one\n- two\n\n<script>alert(1)</script>', status: 'published', featured: false })
expect(r.status === 201, 'a post published', r.json)
r = await anon.req('GET', '/api/public/news?limit=3')
expect(r.json.items[0].title === 'ELIA welcomes new members', 'it leads the public news feed')
const pubForm = new FormData()
for (const [k, v] of Object.entries({ title: 'Member Market Brief Q3', type: 'Report', year: '2026', access: 'members', summary: 'Prices and buyers.', status: 'published' })) pubForm.append(k, v)
pubForm.append('file', new Blob([Buffer.from('%PDF-1.4\n% brief\n')], { type: 'application/pdf' }), 'brief.pdf')
r = await sec.req('POST', '/api/admin/publications', pubForm, { form: true })
expect(r.status === 201, 'a members-only publication with its file', r.json)
r = await mem.req('GET', '/api/member/me/documents')
const doc = r.json.items.find((d) => d.title === 'Member Market Brief Q3')
expect(doc && doc.file, 'members see it under their documents')
r = await anon.req('GET', doc.file.url)
expect(r.status === 302, 'a visitor following its link is sent to sign in')
r = await sec.req('POST', '/api/admin/notices', { title: 'General Assembly called', kind: 'meeting', body: 'On 20 December.', published_on: '2026-10-21' })
expect(r.status === 201, 'a notice', r.json)
r = await sec.req('POST', '/api/admin/opportunities', { title: 'Glove buyer from Japan', kind: 'buyer', body: '5,000 pairs a month.', deadline: '2026-12-01', published_on: '2026-10-21' })
expect(r.status === 201, 'an opportunity', r.json)
r = await mem.req('GET', '/api/member/me/notices')
expect(r.json.items.length === 1, 'members see the notice')
r = await sec.req('POST', '/api/admin/events', { title: 'Tanners’ workshop', starts_on: '2026-12-05', venue: 'Hilton Addis', status: 'published' })
expect(r.status === 201, 'an event', r.json)

// ---- the company's people
r = await mem.req('GET', '/api/member/me/team')
expect(r.json.users.length === 1 && r.json.max === 3, 'the company has one person, of up to three')
r = await mem.req('POST', '/api/member/me/team/invite', { name: 'Dawit', email: 'dawit@kinaff.example' })
expect(r.status === 201, 'invited a colleague (a request for the Secretariat)')

// ---- inbox
r = await sec.req('GET', '/api/admin/inquiries')
expect(r.json.total >= 5, `inbox has ${r.json.total} inquiries`)
r = await sec.req('GET', '/api/admin/inquiries/export.csv')
expect(r.status === 200 && /^\ufeff?Reference,/.test(r.text) && /text\/csv/.test(r.headers.get('content-type')), 'inquiries export to CSV', r.text.slice(0, 80))
r = await sec.req('GET', '/api/admin/companies/export.csv')
expect(r.status === 200 && /Kinaff Leather/.test(r.text), 'members export to CSV')
const imp = new FormData()
imp.append('file', new Blob(['name,category,size,city,region,certifications\nAwash Tannery Test,Tannery,Large,Modjo,Oromia,LWG\nShoe Co Test,shoe manufacturer,small,Addis Ababa,addis ababa,\nNo Category Ltd,,,,,\n']), 'members.csv')
r = await sec.req('POST', '/api/admin/companies/import', imp, { form: true })
expect(r.json.added === 2 && r.json.skipped.length === 1, 'members import from a spreadsheet', r.json)

// ---- the pages the server fills, and the short addresses
const page = async (p) => { const x = await fetch(BASE + p, { redirect: 'manual' }); return { status: x.status, text: await x.text(), to: x.headers.get('location') } }
let pg = await page('/news')
expect(pg.status === 200 && pg.text.includes('ELIA welcomes new members') && pg.text.includes('data-tab="all"'), 'the News page shows the newest post')
pg = await page('/news?tab=events')
expect(pg.text.includes('data-tab="events"') && pg.text.includes('Tanners'), 'the Events tab, with the new event')
pg = await page('/')
expect(pg.text.includes('ELIA welcomes new members'), 'the home page shows the newest post')
const postSlug = (await (await fetch(BASE + '/api/public/news')).json()).items[0].slug
pg = await page(`/news/${postSlug}`)
expect(pg.status === 200 && !/@@[a-z_]+@@/.test(pg.text) && pg.text.includes('ELIA welcomes new members'), 'a post’s own page, every token filled')
expect(!pg.text.includes('<script>alert(1)') && pg.text.includes('&lt;script&gt;alert(1)'), 'HTML typed into a post shows as text')
pg = await page('/templates/news-post')
expect(pg.status === 404, 'the templates themselves are not pages')
pg = await page('/downloads/profile')
expect(pg.status === 302 && /\/files\/.+\.pdf$/.test(pg.to ?? ''), 'the profile’s short address leads to its file', pg.to)
pg = await page('/downloads/no-such-thing')
expect(pg.status === 302 && /tab=publications/.test(pg.to ?? ''), 'an unknown short address leads to the library')
pg = await page('/members')
expect(pg.status === 200 && pg.text.includes('Members directory'), 'the Members page (beside its folder)')
pg = await page('/membership')
expect(pg.status === 301 && /\/members#apply$/.test(pg.to ?? ''), 'the old membership page leads to the application')
pg = await page('/news.html?tab=events')
expect(pg.status === 301 && pg.to === '/news?tab=events', 'an address with .html leads to the clean one', pg.to)
pg = await page('//evil.example/')
expect(pg.status === 301 && pg.to === '/evil.example', 'a doubled slash never leads to another site', pg.to)
pg = await page('/%5Cevil.example/')
expect(pg.status === 301 && !/^\/[\\/]/.test(pg.to ?? ''), 'nor does a backslash', pg.to)
pg = await page('/news?page=1e400')
expect(pg.status === 200, 'a page number too large still shows the news', pg.status)
pg = await page('/news/%E0%A4%A')
expect(pg.status === 400 || pg.status === 404, 'an address that cannot be read is a 4xx', pg.status)
pg = await page('/sitemap.xml')
expect(pg.status === 200 && pg.text.includes('/news/') && pg.text.includes('/events/'), 'the sitemap lists the posts and events')
{
  const sub = outbox().reverse().find((t) => t.startsWith('To: news@example.com'))
  const t = sub && /unsubscribe\?t=([\w-]+)/.exec(sub)?.[1]
  pg = await page('/api/forms/unsubscribe?t=' + t)
  expect(pg.status === 200 && pg.text.includes('Yes, unsubscribe'), 'the unsubscribe link asks first (a mail scanner opening it changes nothing)')
  const u = await anon.req('POST', '/api/forms/unsubscribe', new URLSearchParams({ t }), { form: true })
  expect(u.status === 303, 'pressing the button unsubscribes', u.status)
}

// ---- sign-in, lockout, sign-out
const other = new Client()
for (let i = 0; i < 5; i++) r = await other.req('POST', '/api/auth/login', { email: 'hana@kinaff.example', password: 'wrong-password-' + i })
r = await other.req('POST', '/api/auth/login', { email: 'hana@kinaff.example', password: 'Kinaff-Sheepskin-77' })
expect(r.status === 429, 'five wrong passwords lock the account for a while', r.json)
for (let i = 0; i < 5; i++) r = await other.req('POST', '/api/auth/login', { email: 'nobody@nowhere.example', password: 'wrong-password-' + i })
r = await other.req('POST', '/api/auth/login', { email: 'nobody@nowhere.example', password: 'another-guess' })
expect(r.status === 429, 'an address with no account is stopped the same way (the answer does not tell)', r.json)
r = await other.req('POST', '/api/auth/login', { email: 'admin@eliaet.example', password: 'Leather-Highlands-2026' })
expect(r.status === 200, 'the Secretariat signs in with its password')
r = await sec.req('POST', '/api/auth/logout', {})
r = await sec.req('GET', '/api/admin/overview')
expect(r.status === 401, 'signed out')

console.log(`\nall ${step} checks passed`)
