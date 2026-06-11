import 'server-only'
import { and, desc, eq, gte, lte, sql, like } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog, staffUsers } from '@/lib/db/schema'

export type AuditRow = {
  id: number
  at: number
  actorStaffId: string
  actorEmail: string | null
  actorRole: string
  action: string
  objectType: string
  objectId: string
  reason: string
  ip: string
  prevHash: string
  hash: string
}

export type AuditFilters = {
  actor?: string
  action?: string
  objectType?: string
  fromTs?: number
  toTs?: number
  limit?: number
  offset?: number
}

export async function loadAudit(filters: AuditFilters = {}): Promise<{
  rows: AuditRow[]
  total: number
}> {
  const conds = []
  if (filters.actor) conds.push(eq(auditLog.actorStaffId, filters.actor))
  if (filters.action) conds.push(eq(auditLog.action, filters.action))
  if (filters.objectType) conds.push(eq(auditLog.objectType, filters.objectType))
  if (filters.fromTs) conds.push(gte(auditLog.at, new Date(filters.fromTs)))
  if (filters.toTs) conds.push(lte(auditLog.at, new Date(filters.toTs)))
  const where = conds.length > 0 ? and(...conds) : undefined

  const limit = filters.limit ?? 100
  const offset = filters.offset ?? 0

  const baseQuery = where
    ? db.select().from(auditLog).where(where)
    : db.select().from(auditLog)
  const rows = baseQuery
    .orderBy(desc(auditLog.at))
    .limit(limit)
    .offset(offset)
    .all()

  const totalRow = where
    ? db.select({ n: sql<number>`COUNT(*)` }).from(auditLog).where(where).all()[0]
    : db.select({ n: sql<number>`COUNT(*)` }).from(auditLog).all()[0]
  const total = Number(totalRow?.n ?? 0)

  const staff = db.select().from(staffUsers).all()
  const emailById = new Map(staff.map((s) => [s.id, s.email]))

  return {
    rows: rows.map((r) => ({
      id: r.id,
      at: r.at.getTime(),
      actorStaffId: r.actorStaffId,
      actorEmail: emailById.get(r.actorStaffId) ?? null,
      actorRole: r.actorRole,
      action: r.action,
      objectType: r.objectType,
      objectId: r.objectId,
      reason: r.reason,
      ip: r.ip,
      prevHash: r.prevHash,
      hash: r.hash,
    })),
    total,
  }
}
