import 'server-only'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? './data/console.db'

if (!existsSync(dirname(url))) {
  mkdirSync(dirname(url), { recursive: true })
}

const sqlite = new Database(url)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { schema }
