/* The database: one SQLite file in the data folder (outside anything the web server serves), through Node's own
   driver (node:sqlite, Node 22.5+; no native package to install on the host). WAL mode, so the pages can read while
   a form writes; foreign keys on; a writer waits up to five seconds for another instead of failing. */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { config } from './config.js'
import { MIGRATIONS } from './migrations.js'

export type Row = Record<string, any>
export interface Statement {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }
  get(...params: unknown[]): Row | undefined
  all(...params: unknown[]): Row[]
}
interface Driver {
  prepare(sql: string): Statement
  exec(sql: string): void
  close(): void
}

const require = createRequire(import.meta.url)

function open(file: string): Driver {
  // node:sqlite prints an "experimental" warning once; it is the driver we mean to use
  const emit = process.emitWarning
  process.emitWarning = ((w: string | Error, ...rest: unknown[]) => {
    if (String(typeof w === 'string' ? w : w.message).includes('SQLite')) return
    return (emit as (...a: unknown[]) => void).call(process, w, ...rest)
  }) as typeof process.emitWarning
  try {
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    return new DatabaseSync(file) as unknown as Driver
  } finally {
    process.emitWarning = emit
  }
}

let driver: Driver | null = null
const cache = new Map<string, Statement>()

export function db(): Driver {
  if (driver) return driver
  fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 })
  const file = path.join(config.dataDir, 'elia.sqlite')
  driver = open(file)
  driver.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  try { fs.chmodSync(file, 0o600) } catch { /* not the owner: leave it */ }
  migrate(driver)
  return driver
}

/** A prepared statement, kept for reuse. */
export function q(sql: string): Statement {
  let s = cache.get(sql)
  if (!s) {
    s = db().prepare(sql)
    cache.set(sql, s)
  }
  return s
}

export const one = <T = Row>(sql: string, ...p: unknown[]) => q(sql).get(...p) as T | undefined
export const all = <T = Row>(sql: string, ...p: unknown[]) => q(sql).all(...p) as T[]
export function run(sql: string, ...p: unknown[]) {
  const r = q(sql).run(...p)
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) }
}

let depth = 0
/** Runs fn in one transaction (nested calls join the outer one). */
export function tx<T>(fn: () => T): T {
  const d = db()
  if (depth > 0) return fn()
  d.exec('BEGIN IMMEDIATE')
  depth++
  try {
    const out = fn()
    d.exec('COMMIT')
    return out
  } catch (e) {
    try { d.exec('ROLLBACK') } catch { /* already rolled back */ }
    throw e
  } finally {
    depth--
  }
}

function migrate(d: Driver) {
  d.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
  const done = new Set((d.prepare('SELECT version FROM schema_migrations').all() as Row[]).map((r) => Number(r.version)))
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue
    d.exec('BEGIN IMMEDIATE')
    try {
      d.exec(m.sql)
      d.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(m.version, new Date().toISOString())
      d.exec('COMMIT')
      console.log(`[db] migration ${m.version} (${m.name}) applied`)
    } catch (e) {
      d.exec('ROLLBACK')
      throw e
    }
  }
}

export function closeDb() {
  driver?.close()
  driver = null
  cache.clear()
}

/** ISO time now (UTC). */
export const now = () => new Date().toISOString()

/** JSON column helpers */
export const toJson = (v: unknown) => JSON.stringify(v ?? null)
export function fromJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== 'string' || !v) return fallback
  try { return JSON.parse(v) as T } catch { return fallback }
}
