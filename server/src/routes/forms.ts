/* The public forms (Contact page, Invest page, AALF, the home page's appointment, the newsletter, the membership
   application). Each one: the hidden field bots fill, the browser's solved spam puzzle, a rate limit per visitor;
   then it is kept in the database (the Secretariat's inbox), e-mailed to the team it is for (the content document's
   "Sent to"), and the sender gets a confirmation with a reference. */
import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { config, type Team } from '../config.js'
import { run, now, toJson, one } from '../db.js'
import { send, lines, link } from '../mail.js'
import { powChallenge, powCheck, limit, allow, randomToken, sha256, visitor, siteAllows } from '../security.js'
import { store } from '../files.js'
import { HttpError, parse, wrap, req, opt, email, day, intOrNull } from '../util.js'
import { esc } from '../../../shared/markdown.js'
import { CATEGORIES, SIZES, REGIONS, INQUIRIES, INTERESTS, TEAMS, type InquiryKind } from '../../../shared/options.js'

export const forms = Router()

const ACK = 'Thank you for contacting the Ethiopian Leather Industries Association. We have received your message and will reply within three working days.'

forms.get('/pow', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json(powChallenge())
})

const SPAM_CHECK = 'The form’s spam check did not finish. Please wait a moment and send it again.'

/** The limits a form is sent under: a few an hour from one visitor, and a ceiling for the whole site (so the inbox
    cannot be flooded even by someone who looks like many visitors). */
function limits(req: Request, form: string, perHour: number) {
  const v = visitor(req)
  limit(`form:${form}:${v.key}`, perHour * v.times, 3600, `Too many sends from this connection. Please try again in an hour, or e-mail ${config.contactEmail}.`)
  limit(`form:${form}:site`, 100, 3600, `The form is very busy at the moment. Please try again in an hour, or e-mail ${config.contactEmail}.`)
}

/** The checks every public form starts with. A filled honeypot gets a normal-looking answer and is dropped. */
function guard(req: Request, form: string, perHour = 8): boolean {
  if (String(req.body?.website_url ?? '').trim()) return false
  limits(req, form, perHour)
  if (!powCheck(req.body?.pow)) throw new HttpError(400, SPAM_CHECK, { form: 'spam-check' })
  return true
}

/** The confirmation to the sender: only a fixed text and the reference, nothing that was typed in (the forms must not
    carry someone else's words to a stranger's inbox), at most three a day to one address and 120 an hour in all. */
async function confirm(to: string, subject: string, text: string) {
  if (!siteAllows('autoreply', 120, 3600) || !allow(`autoreply:${sha256(to)}`, 3, 86400)) return
  await send({ to, subject, text: `Hello,\n\n${text}\n\nIf you did not write to ELIA through its website, please ignore this e-mail.` })
}

const refCode = () => 'ELIA-' + randomToken(6).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6).padEnd(6, 'X')

/* ---- the inquiry forms ---- */

const country = opt(80)
const SCHEMAS: Record<Exclude<InquiryKind, never>, z.ZodTypeAny> = {
  general: z.object({
    name: req(120), organization: opt(160), email, phone: opt(40), country, subject: req(200), message: req(5000),
  }),
  buyer: z.object({
    company: req(160), name: req(120), country: req(80), email, phone: opt(40),
    product: req(120), quantity: opt(120), quality: opt(1000), delivery: day, message: opt(5000),
  }),
  investor: z.object({
    company: req(160), name: req(120), country: req(80), email, phone: opt(40),
    area: req(160), size: opt(120), location: opt(160), message: opt(5000),
  }),
  aalf: z.object({
    company: req(160), name: req(120), email, phone: opt(40),
    interest: z.enum(['Exhibit', 'Sponsor', 'Visit'], { error: 'Choose one' }), booth: opt(80), message: opt(5000),
  }),
  media: z.object({
    name: req(120), outlet: req(160), email, phone: opt(40), deadline: day, request: req(5000),
  }),
  appointment: z.object({
    name: req(120), email, mobile: req(40), sector: z.enum(['Tannery', 'Shoe manufacturing', 'Leather products'], { error: 'Choose one' }),
    date: z.iso.date('Pick a date'), message: opt(5000),
  }),
}

const LABELS: Record<string, string> = {
  name: 'Name', organization: 'Organization', email: 'E-mail', phone: 'Phone', country: 'Country', subject: 'Subject',
  message: 'Message', company: 'Company', product: 'Product category', quantity: 'Quantity', quality: 'Quality requirements',
  delivery: 'Target delivery date', area: 'Investment area', size: 'Estimated investment size', location: 'Preferred location',
  interest: 'Interest', booth: 'Booth size', outlet: 'Media outlet', deadline: 'Deadline', request: 'Request',
  mobile: 'Mobile', sector: 'Sector', date: 'Preferred date',
}

/* ---- the newsletter ---- */

forms.post('/forms/subscribe', wrap(async (req, res) => {
  if (!guard(req, 'subscribe', 10)) return void res.status(201).json({ ok: true })
  const d = parse(z.object({
    email,
    interests: z.preprocess((v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : String(v).split(',')),
      z.array(z.enum(INTERESTS)).max(INTERESTS.length)),
  }), req.body)
  const had = one<{ id: number; unsubscribed_at: string | null }>('SELECT id, unsubscribed_at FROM subscribers WHERE email = ?', d.email)
  if (had) {
    run('UPDATE subscribers SET interests = ?, unsubscribed_at = NULL WHERE id = ?', toJson(d.interests), had.id)
  } else {
    run('INSERT INTO subscribers (email, interests, token, created_at) VALUES (?, ?, ?, ?)', d.email, toJson(d.interests), randomToken(18), now())
  }
  const s = one<{ token: string }>('SELECT token FROM subscribers WHERE email = ?', d.email)!
  if ((!had || had.unsubscribed_at) && siteAllows('autoreply', 120, 3600) && allow(`autoreply:${sha256(d.email)}`, 3, 86400)) {
    const out = link('/api/forms/unsubscribe?t=' + s.token)
    await send({
      to: d.email,
      subject: 'You are subscribed to ELIA’s updates',
      text: `Thank you for subscribing. You will receive news, events and opportunities from the Ethiopian Leather Industries Association now and then.\n\nTo stop them at any time: ${out}\n\nIf you did not subscribe on the ELIA website, open that link to be taken off the list.`,
      unsubscribe: out,
    })
  }
  res.status(201).json({ ok: true })
}))

/* Unsubscribing: the e-mailed link opens a page with one button, and only pressing it unsubscribes (mail scanners
   that open every link in a message would otherwise unsubscribe people as soon as the e-mail arrives). */
forms.get('/forms/unsubscribe', wrap((req, res) => {
  const t = String(req.query.t ?? '').slice(0, 64)
  const sub = t ? one<{ email: string; unsubscribed_at: string | null }>('SELECT email, unsubscribed_at FROM subscribers WHERE token = ?', t) : null
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')
  if (!sub || sub.unsubscribed_at) return void res.redirect(302, '/news?unsubscribed=1')
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribe · ELIA</title><meta name="robots" content="noindex"><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#3c1e16;color:#fffcf5;font:17px/1.5 system-ui,sans-serif}
main{max-width:30rem;padding:2rem}h1{font-size:1.6rem;margin:0 0 .5rem}p{color:#e9e1d6}
button{margin-top:1rem;font:inherit;font-weight:600;padding:.8rem 1.4rem;border:0;border-radius:999px;background:#e2a025;color:#3c1e16;cursor:pointer}
a{color:#e2a025}</style></head><body><main><h1>Unsubscribe from ELIA’s updates?</h1>
<p>${esc(sub.email)} will no longer receive news, events and opportunities from the Ethiopian Leather Industries Association.</p>
<form method="post" action="/api/forms/unsubscribe"><input type="hidden" name="t" value="${esc(t)}"><button type="submit">Yes, unsubscribe</button></form>
<p><a href="/">Back to the website</a></p></main></body></html>`)
}))
forms.post('/forms/unsubscribe', wrap((req, res) => {
  const t = String(req.body?.t ?? '').slice(0, 64)
  if (t) run('UPDATE subscribers SET unsubscribed_at = ? WHERE token = ? AND unsubscribed_at IS NULL', now(), t)
  res.redirect(303, '/news?unsubscribed=1')
}))

/* ---- the membership application ---- */

const application = z.object({
  companyName: req(200),
  contactName: req(120),
  position: opt(120),
  phone: req(40),
  email,
  category: z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES], { error: 'Choose one' }),
  size: z.enum(Object.keys(SIZES) as [keyof typeof SIZES], { error: 'Choose one' }),
  region: z.enum(Object.keys(REGIONS) as [keyof typeof REGIONS], { error: 'Choose one' }),
  address: req(240),
  products: req(600),
  yearEstablished: intOrNull(1900, new Date().getFullYear()),
  employees: intOrNull(0, 1_000_000),
  exportMarkets: opt(400),
  message: opt(5000),
  consent: z.literal('true', { error: 'Please confirm' }),
})

/* The application carries a file, so everything that can be checked is checked before the upload is read: its size
   (from the request's length), the limits, and the spam check, which the page sends as a header (X-Pow) for this
   form. The upload itself is held to one file of 8 MB and a few short fields. */
const LICENCE_MB = 8
const applicationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LICENCE_MB * 1024 * 1024, files: 1, fields: 30, fieldSize: 16 * 1024, parts: 31 },
})
function beforeUpload(req: Request, _res: Response, next: NextFunction) {
  try {
    const length = Number(req.headers['content-length'])
    if (!Number.isFinite(length) || length <= 0) throw new HttpError(411, 'The application could not be read. Please send it again.')
    if (length > (LICENCE_MB + 1) * 1024 * 1024) throw new HttpError(413, `The trade licence must be under ${LICENCE_MB} MB.`, { licence: `Max ${LICENCE_MB} MB` })
    limits(req, 'membership', 6)
    if (!powCheck(req.headers['x-pow'])) throw new HttpError(400, SPAM_CHECK, { form: 'spam-check' })
    next()
  } catch (e) { next(e) }
}

forms.post('/forms/membership', beforeUpload, applicationUpload.single('licence'), wrap(async (req, res) => {
  if (String(req.body?.website_url ?? '').trim()) return void res.status(201).json({ ok: true, ref: refCode() })
  const d = parse(application, req.body)
  if (d.yearEstablished == null) throw new HttpError(422, 'Please check the highlighted fields.', { yearEstablished: 'Enter a year' })
  if (!req.file) throw new HttpError(422, 'Please attach the company’s trade licence.', { licence: 'Attach the trade licence (PDF or a photo of it)' })
  // a ceiling on what the whole site keeps in a day, so the disk cannot be filled by someone posing as many applicants
  if (!siteAllows('licences', 60, 86400)) throw new HttpError(429, `Too many applications today. Please try again tomorrow, or e-mail ${config.contactEmail}.`)
  const licence = store(req.file, 'licence', 'private', null, 'licence')
  const ref = refCode()
  const { consent: _c, ...data } = d
  const id = run(`INSERT INTO applications (company_name, contact_name, email, category, data, licence_file_id, status, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, 'new', ?)`,
    d.companyName, d.contactName, d.email, d.category, toJson({ ...data, ref }), licence, now()).id
  const body = lines([
    ['Company', d.companyName], ['Contact person', d.contactName], ['Position', d.position], ['Phone', d.phone], ['E-mail', d.email],
    ['Category', CATEGORIES[d.category]], ['Size', SIZES[d.size]], ['Region', REGIONS[d.region]], ['Address', d.address],
    ['Main products', d.products], ['Year established', d.yearEstablished], ['Employees', d.employees], ['Export markets', d.exportMarkets],
    ['Message', d.message], ['Trade licence', licence ? 'attached in the back office' : 'not sent'],
  ])
  await send({
    to: config.teams.members,
    subject: `[ELIA website] Membership application · ${d.companyName} (${ref})`,
    text: `A membership application, for Member Services.\n\n${body}\n\nReview it in the back office: ${link('/admin#applications/' + id)}`,
    replyTo: d.email,
  })
  await confirm(d.email, `Your ELIA membership application (${ref})`,
    `Thank you for applying to join the Ethiopian Leather Industries Association. The Secretariat will contact you within ten working days.\n\nYour reference: ${ref}`)
  res.status(201).json({ ok: true, ref })
}))

/* ---- the inquiry forms (after the named ones above, which this would otherwise catch) ---- */

forms.post('/forms/:kind', wrap(async (req, res) => {
  const kind = String(req.params.kind) as InquiryKind
  if (!Object.hasOwn(SCHEMAS, kind)) throw new HttpError(404, 'Not found')
  if (!guard(req, kind)) return void res.status(201).json({ ok: true, ref: refCode() })
  const d = parse(SCHEMAS[kind], req.body) as Record<string, string | null>
  const team = INQUIRIES[kind].team as Team
  const ref = refCode()
  const subject = d.subject || d.product || d.area || (d.interest ? `${d.interest} at AALF` : '') || (kind === 'media' ? `Media: ${d.outlet}` : '') ||
    (kind === 'appointment' ? `Appointment on ${d.date}` : INQUIRIES[kind].label)
  run(`INSERT INTO inquiries (ref, kind, team, name, email, organization, subject, data, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
    ref, kind, team, d.name ?? '', d.email ?? '', d.organization || d.company || d.outlet || '', String(subject).slice(0, 200), toJson(d), now())
  const body = lines(Object.entries(d).map(([k, v]) => [LABELS[k] ?? k, v]))
  await send({
    to: config.teams[team],
    subject: `[ELIA website] ${INQUIRIES[kind].label} · ${d.organization || d.company || d.outlet || d.name} (${ref})`,
    text: `${INQUIRIES[kind].label}, for ${TEAMS[team]}.\n\n${body}\n\nReference ${ref}. Reply to this e-mail to answer them directly.\nIn the back office: ${link('/admin#inquiries')}`,
    replyTo: d.email ?? undefined,
  })
  await confirm(d.email!, `We have received your message (${ref})`, `${ACK}\n\nYour reference: ${ref}`)
  res.status(201).json({ ok: true, ref })
}))
