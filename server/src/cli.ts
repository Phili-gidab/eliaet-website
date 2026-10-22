/* Jobs for the server's command line (over SSH, in the app's folder):

     node server/dist/cli.mjs create-admin someone@eliaet.com "Their Name"   a Secretariat account; they get an
                                                                              e-mail with a link to set the password
     node server/dist/cli.mjs send-link someone@eliaet.com                    a new set-password link for an account
     node server/dist/cli.mjs backup ~/elia-backups                           a copy of the database and the files
     node server/dist/cli.mjs stats                                           what is in the database

   Add --print-link to the first two to also see the link here (for when e-mail is not working yet). */
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { db, one, run, now, closeDb } from './db.js'
import { issueLink, sendWelcome } from './routes/auth.js'
import { seedIfEmpty } from './seed.js'

const USAGE = `Usage (in the app's folder):
  node server/dist/cli.mjs create-admin <email> "<name>" [--print-link]
  node server/dist/cli.mjs send-link <email> [--print-link]
  node server/dist/cli.mjs backup [folder]
  node server/dist/cli.mjs stats`
const [cmd, ...args] = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const pos = args.filter((a) => !a.startsWith('--'))
const fail = (msg: string): never => { console.error(msg); process.exit(1) }

async function main() {
  db()
  seedIfEmpty()
  switch (cmd) {
    case 'create-admin': {
      const [email, ...nameParts] = pos
      const name = nameParts.join(' ').trim()
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) fail('Usage: create-admin <email> "<name>" [--print-link]')
      const u = one<{ id: number; role: string }>('SELECT id, role FROM users WHERE email = ?', email.toLowerCase())
      let id: number
      if (u) {
        run(`UPDATE users SET role = 'secretariat', company_id = NULL, status = 'active', name = ?, updated_at = ? WHERE id = ?`, name, now(), u.id)
        id = u.id
        console.log(`${email} is now a Secretariat account.`)
      } else {
        id = run(`INSERT INTO users (email, name, role, status, created_at, updated_at) VALUES (?, ?, 'secretariat', 'active', ?, ?)`,
          email.toLowerCase(), name, now(), now()).id
        console.log(`Created the Secretariat account ${email}.`)
      }
      await finishLink(id, email)
      break
    }
    case 'send-link': {
      const [email] = pos
      const u = email ? one<{ id: number }>('SELECT id FROM users WHERE email = ? AND status = ?', email.toLowerCase(), 'active') : undefined
      if (!u) fail(`No active account for ${email ?? '(no address given)'}.`)
      await finishLink(u!.id, email)
      break
    }
    case 'backup': {
      const dir = path.resolve(pos[0] ?? path.join(config.dataDir, '..', 'elia-backups'))
      const stamp = now().replace(/[:.]/g, '-').slice(0, 19)
      const target = path.join(dir, `elia-${stamp}`)
      fs.mkdirSync(target, { recursive: true, mode: 0o700 })
      db().exec(`VACUUM INTO '${path.join(target, 'elia.sqlite').replace(/'/g, "''")}'`)
      const files = path.join(config.dataDir, 'files')
      if (fs.existsSync(files)) fs.cpSync(files, path.join(target, 'files'), { recursive: true })
      console.log(`Backed up to ${target}`)
      break
    }
    case 'stats': {
      for (const t of ['companies', 'users', 'access_requests', 'applications', 'profile_changes', 'posts', 'events', 'publications', 'notices', 'opportunities', 'inquiries', 'subscribers']) {
        console.log(`${t.padEnd(16)} ${one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)?.n}`)
      }
      console.log(`${'secretariat'.padEnd(16)} ${one<{ n: number }>(`SELECT COUNT(*) AS n FROM users WHERE role = 'secretariat' AND status = 'active'`)?.n}`)
      const m = config.mail
      console.log(`${'e-mail'.padEnd(16)} ${m.outboxOnly ? 'written to the data folder\'s outbox, not sent' : m.smtp ? `by SMTP (${m.smtp.host})` : m.sendmail ? `by the server's sendmail (${m.sendmail})` : 'OFF: no SMTP set and no sendmail found'}`)
      console.log(`${'e-mail from'.padEnd(16)} ${m.from}`)
      break
    }
    default:
      console.log(USAGE)
      process.exit(cmd ? 1 : 0)
  }
}

async function finishLink(id: number, email: string) {
  if (flags.has('--print-link')) {
    console.log(`Link to set the password (72 hours, once):\n  ${issueLink(id, 'set_password')}`)
  } else {
    const ok = await sendWelcome(id)
    console.log(ok ? `E-mailed ${email} a link to set the password (it works for 72 hours, once).`
      : `Could not send the e-mail. Run this again with --print-link to see the link here.`)
  }
}

main().then(() => closeDb()).catch((e) => { console.error(e); closeDb(); process.exit(1) })
