/* E-mail: SMTP when it is set up, otherwise the host's sendmail (cPanel's Exim), and in development a folder
   (data/outbox/) instead of sending. Plain text: it reads everywhere, and nothing in it can be mistaken for a
   picture-heavy campaign. A message that cannot be sent is logged; what it was about is already in the database. */
import fs from 'node:fs'
import path from 'node:path'
import nodemailer, { type Transporter } from 'nodemailer'
import { config } from './config.js'

type Attachment = { filename: string; path?: string; content?: Buffer; contentType?: string }
export interface Mail {
  to: string | string[]
  subject: string
  text: string
  replyTo?: string
  attachments?: Attachment[]
}

let transport: Transporter | null | undefined

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport
  const m = config.mail
  if (m.outboxOnly) transport = null
  else if (m.smtp) {
    transport = nodemailer.createTransport({
      host: m.smtp.host, port: m.smtp.port, secure: m.smtp.secure,
      auth: m.smtp.user ? { user: m.smtp.user, pass: m.smtp.pass } : undefined,
    })
  } else if (m.sendmail) {
    transport = nodemailer.createTransport({ sendmail: true, newline: 'unix', path: m.sendmail })
  } else transport = null
  return transport
}

const SIGN = '\n\n—\nEthiopian Leather Industries Association (ELIA)\nAddis Ababa, Ethiopia · ' + 'www.eliaet.com'

/** Sends one e-mail; resolves false (and logs) when it could not go. Never throws. */
export async function send(m: Mail): Promise<boolean> {
  const msg = { from: config.mail.from, to: m.to, subject: m.subject, text: m.text + SIGN, replyTo: m.replyTo, attachments: m.attachments }
  const t = getTransport()
  if (!t) {
    try {
      const dir = path.join(config.dataDir, 'outbox')
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
      const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 7)}.txt`
      const head = [`To: ${[m.to].flat().join(', ')}`, `Subject: ${m.subject}`, m.replyTo ? `Reply-To: ${m.replyTo}` : '',
        (m.attachments ?? []).length ? `Attachments: ${(m.attachments ?? []).map((a) => a.filename).join(', ')}` : ''].filter(Boolean)
      fs.writeFileSync(path.join(dir, name), head.join('\n') + '\n\n' + msg.text + '\n', { mode: 0o600 })
    } catch (e) {
      console.error('[mail] could not write to the outbox:', (e as Error).message)
    }
    return true
  }
  try {
    await t.sendMail(msg)
    return true
  } catch (e) {
    console.error(`[mail] could not send "${m.subject}" to ${[m.to].flat().join(', ')}:`, (e as Error).message)
    return false
  }
}

/** "Label: value" lines, blank values left out. */
export function lines(fields: [label: string, value: unknown][]): string {
  return fields
    .filter(([, v]) => v !== '' && v != null && !(Array.isArray(v) && !v.length))
    .map(([l, v]) => {
      const s = Array.isArray(v) ? v.join(', ') : String(v)
      return s.includes('\n') ? `${l}:\n${s}` : `${l}: ${s}`
    })
    .join('\n')
}

export const link = (p: string) => config.siteUrl + p
