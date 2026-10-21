/* The public forms (Contact page, Invest page, AALF, the home page's appointment, the newsletter, the membership
   application). Each one: the hidden field bots fill, the browser's solved spam puzzle, a rate limit per visitor;
   then it is kept in the database (the Secretariat's inbox), e-mailed to the team it is for (the content document's
   "Sent to"), and the sender gets a confirmation with a reference. */
import { Router, type Request } from 'express'
import { z } from 'zod'
import { config, type Team } from '../config.js'
import { run, now, toJson, one } from '../db.js'
import { send, lines, link } from '../mail.js'
import { powChallenge, powCheck, limit, ipKey, randomToken } from '../security.js'
import { upload, store } from '../files.js'
import { HttpError, parse, wrap, req, opt, email, day, intOrNull, ipOf } from '../util.js'
import { CATEGORIES, SIZES, REGIONS, INQUIRIES, INTERESTS, TEAMS, type InquiryKind } from '../../../shared/options.js'

export const forms = Router()

const ACK = 'Thank you for contacting the Ethiopian Leather Industries Association. We have received your message and will reply within three working days.'

forms.get('/pow', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json(powChallenge())
})

/** The checks every public form starts with. A filled honeypot gets a normal-looking answer and is dropped. */
function guard(req: Request, form: string, perHour = 8): boolean {
  if (String(req.body?.website_url ?? '').trim()) return false
  limit(`form:${form}:${ipKey(ipOf(req))}`, perHour, 3600, `Too many sends from this connection. Please try again in an hour, or e-mail ${config.contactEmail}.`)
  if (!powCheck(req.body?.pow)) {
    throw new HttpError(400, 'The form’s spam check did not finish. Please wait a moment and send it again.', { form: 'spam-check' })
  }
  return true
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
  if (!had || had.unsubscribed_at) {
    await send({
      to: d.email,
      subject: 'You are subscribed to ELIA’s updates',
      text: `Thank you for subscribing. You will receive news, events and opportunities from the Ethiopian Leather Industries Association now and then.\n\nTo stop them at any time: ${link('/api/forms/unsubscribe?t=' + s.token)}`,
    })
  }
  res.status(201).json({ ok: true })
}))

forms.get('/forms/unsubscribe', wrap((req, res) => {
  const t = String(req.query.t ?? '')
  if (t) run('UPDATE subscribers SET unsubscribed_at = ? WHERE token = ? AND unsubscribed_at IS NULL', now(), t)
  res.redirect(302, '/news?unsubscribed=1')
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

forms.post('/forms/membership', upload.single('licence'), wrap(async (req, res) => {
  if (!guard(req, 'membership', 6)) return void res.status(201).json({ ok: true, ref: refCode() })
  const d = parse(application, req.body)
  if (d.yearEstablished == null) throw new HttpError(422, 'Please check the highlighted fields.', { yearEstablished: 'Enter a year' })
  if (!req.file) throw new HttpError(422, 'Please attach the company’s trade licence.', { licence: 'Attach the trade licence (PDF or a photo of it)' })
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
  await send({
    to: d.email,
    subject: `Your ELIA membership application (${ref})`,
    text: `Dear ${d.contactName},\n\nThank you for applying to join the Ethiopian Leather Industries Association. The Secretariat will contact you within ten working days.\n\nYour reference: ${ref}\n\nWhat you sent:\n${body}`,
  })
  res.status(201).json({ ok: true, ref })
}))

/* ---- the inquiry forms (after the named ones above, which this would otherwise catch) ---- */

forms.post('/forms/:kind', wrap(async (req, res) => {
  const kind = String(req.params.kind) as InquiryKind
  if (!(kind in SCHEMAS)) throw new HttpError(404, 'Not found')
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
  await send({
    to: d.email!,
    subject: `We have received your message (${ref})`,
    text: `Dear ${d.name},\n\n${ACK}\n\nYour reference: ${ref}\n\nWhat you sent:\n${body}`,
  })
  res.status(201).json({ ok: true, ref })
}))
