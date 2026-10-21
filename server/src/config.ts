/* The server's settings, from the environment (server/.env in development; in production the hosting's app settings
   or a .env file in the data folder). Everything has a working default for development. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const here = path.dirname(fileURLToPath(import.meta.url))
/** server/ — the same whether running from src/ (tsx) or dist/ (the bundle). */
export const ROOT = path.resolve(here, '..')
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true })

const isProd = process.env.NODE_ENV === 'production'
/** Where the database, the uploads and the secret live: never inside the site's folder. */
const dataDir = path.resolve(ROOT, process.env.DATA_DIR ?? '.data')
// a .env in the data folder (written by the deploy script on the server) fills in what the environment does not set
dotenv.config({ path: path.join(dataDir, '.env'), quiet: true })

const env = (k: string, d = '') => (process.env[k] ?? d).trim()
const list = (k: string, d: string) => env(k, d).split(',').map((s) => s.trim()).filter(Boolean)

/** A random key made once and kept in the data folder: signs the anti-spam puzzles and the unsubscribe links. */
function secret(): string {
  if (env('APP_SECRET')) return env('APP_SECRET')
  const file = path.join(dataDir, 'secret.key')
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 })
    const s = crypto.randomBytes(32).toString('base64url')
    fs.writeFileSync(file, s + '\n', { mode: 0o600 })
    return s
  }
}

const siteUrl = env('SITE_URL', isProd ? 'https://www.eliaet.com' : 'http://localhost:4000').replace(/\/+$/, '')
const notify = env('NOTIFY_TO', 'info@eliaet.com')

export const config = {
  port: Number(env('PORT', '4000')),
  isProd,
  /** the site's own address, for links in e-mails */
  siteUrl,
  /** the address people reach the site at must match this origin on every form post (CSRF) */
  origins: list('ALLOWED_ORIGINS', siteUrl),
  dataDir,
  /** the content the database starts with (members, news), shipped with the site */
  seedDir: path.join(ROOT, 'data'),
  /** The built website (Astro, ../web/dist). CLIENT_DIST overrides it. */
  clientDist: path.resolve(ROOT, env('CLIENT_DIST', path.join('..', 'web', 'dist'))),
  secret: secret(),
  mail: {
    /** SMTP when SMTP_HOST is set; otherwise the host's sendmail (cPanel has one); otherwise nothing is sent */
    smtp: env('SMTP_HOST')
      ? {
          host: env('SMTP_HOST'),
          port: Number(env('SMTP_PORT', '587')),
          secure: env('SMTP_SECURE') === 'true',
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        }
      : null,
    sendmail: env('SENDMAIL_PATH', ['/usr/sbin/sendmail', '/usr/lib/sendmail'].find((p) => fs.existsSync(p)) ?? ''),
    from: env('MAIL_FROM', 'ELIA website <no-reply@eliaet.com>'),
    /** when true, nothing is sent: the messages are written to data/outbox/ (development) */
    outboxOnly: env('MAIL_OUTBOX') === 'true' || (!isProd && !env('SMTP_HOST')),
  },
  /** who receives what: the Secretariat's teams (the content document's "Sent to" column) */
  teams: {
    secretariat: env('TEAM_SECRETARIAT', notify),
    members: env('TEAM_MEMBERS', notify),
    programs: env('TEAM_PROGRAMS', notify),
    aalf: env('TEAM_AALF', 'elia.aalf2@gmail.com'),
    comms: env('TEAM_COMMS', notify),
  },
  contactEmail: env('CONTACT_EMAIL', 'info@eliaet.com'),
  /** a member company may have this many people signed up */
  usersPerCompany: Number(env('USERS_PER_COMPANY', '3')),
  /** a session lasts this long without a visit (and at most 30 days) */
  sessionDays: Number(env('SESSION_DAYS', '14')),
  /** the session cookie: __Host- (HTTPS only, this host only) in production */
  cookie: isProd ? '__Host-elia' : 'elia_sid',
  secureCookie: isProd,
}

export type Team = keyof typeof config.teams
