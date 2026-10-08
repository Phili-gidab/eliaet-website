import fs from 'node:fs/promises'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { config } from './config.js'

export type Kind = 'contact' | 'appointment' | 'membership' | 'subscribe'

const transport = config.smtp
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null

const SUBJECT: Record<Kind, string> = {
  contact: 'Website message',
  appointment: 'Appointment request',
  membership: 'Membership application',
  subscribe: 'Newsletter sign-up',
}

/** Stores a submission as one JSON line in inbox/<kind>.jsonl, then e-mails the secretariat if SMTP is set.
    A mail failure never loses the submission: it is written first. */
export async function deliver(kind: Kind, data: Record<string, unknown>, attachments: { filename: string; path: string }[] = []) {
  const record = { id: crypto.randomUUID(), kind, receivedAt: new Date().toISOString(), ...data }
  await fs.mkdir(config.inboxDir, { recursive: true })
  await fs.appendFile(path.join(config.inboxDir, `${kind}.jsonl`), JSON.stringify(record) + '\n', 'utf8')

  if (transport && config.smtp) {
    const lines = Object.entries(data)
      .filter(([, v]) => v !== '' && v != null)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    try {
      await transport.sendMail({
        from: config.smtp.from,
        to: config.notifyTo,
        replyTo: typeof data.email === 'string' ? data.email : undefined,
        subject: `[eliaet.com] ${SUBJECT[kind]}${typeof data.name === 'string' ? ` · ${data.name}` : ''}`,
        text: lines.join('\n'),
        attachments,
      })
    } catch (err) {
      console.error(`[inbox] stored ${record.id} but could not e-mail it:`, (err as Error).message)
    }
  }
  return record.id
}
