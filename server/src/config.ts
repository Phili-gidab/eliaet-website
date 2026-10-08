import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
/** server/ — the same whether running from src/ (tsx) or dist/ (node). */
export const ROOT = path.resolve(here, '..')

export const config = {
  port: Number(process.env.PORT ?? 4000),
  isProd: process.env.NODE_ENV === 'production',
  dataDir: path.join(ROOT, 'data'),
  /** Form submissions (JSON lines) and uploaded stamps. Kept outside anything that is served. */
  inboxDir: path.resolve(ROOT, process.env.INBOX_DIR ?? 'inbox'),
  /** The built website (Astro, ../web/dist). CLIENT_DIST overrides it, e.g. to try a build elsewhere. */
  clientDist: path.resolve(ROOT, process.env.CLIENT_DIST ?? path.join('..', 'web', 'dist')),
  /** Optional e-mail notifications. With no SMTP_HOST, submissions are only stored in the inbox. */
  smtp: process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER ?? '',
        pass: process.env.SMTP_PASS ?? '',
        from: process.env.MAIL_FROM ?? 'ELIA website <no-reply@eliaet.com>',
      }
    : null,
  notifyTo: process.env.NOTIFY_TO ?? 'info@eliaet.com',
}
