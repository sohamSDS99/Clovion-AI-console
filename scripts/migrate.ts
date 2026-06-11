// Applies Drizzle migrations to data/console.db using better-sqlite3.
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const url = process.env.DATABASE_URL ?? './data/console.db'

if (!existsSync(dirname(url))) {
  mkdirSync(dirname(url), { recursive: true })
}

const sqlite = new Database(url)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite)

migrate(db, { migrationsFolder: './lib/db/migrations' })

console.log('migrations applied →', url)
sqlite.close()
