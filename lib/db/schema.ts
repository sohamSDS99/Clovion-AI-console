// SQLite schema for the Clovion Console — Drizzle ORM.
// Tables follow PRD §4.3 (data model) and §A (metrics dictionary).
// Money: *_usd_cents (integer). LLM cost: *_usd_microcents (integer).
// Timestamps: integer({ mode: 'timestamp_ms' }).

import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core'

// ----- staff & auth -----
export type Role = 'owner' | 'admin' | 'analyst' | 'support' | 'engineer'

export const staffUsers = sqliteTable('staff_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  role: text('role').$type<Role>().notNull().default('analyst'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
})

// Schema continues in the rebuild phase — see lib/admin/metrics for the semantic layer.
