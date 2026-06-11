import 'server-only'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adminActions, accounts } from '@/lib/db/schema'
import type { AdminActionType, AdminActionStatus } from '@/lib/db/types'

export type AdminActionRow = {
  id: string
  type: AdminActionType
  status: AdminActionStatus
  requestedBy: string
  approvedBy: string | null
  targetAccountId: string | null
  targetAccountName: string | null
  params: Record<string, unknown>
  expiresAt: number | null
  createdAt: number
  updatedAt: number
}

export type OperationsData = {
  pending: AdminActionRow[]
  active: AdminActionRow[]
  history: AdminActionRow[]
  byType: Record<AdminActionType, number>
}

export async function loadOperations(): Promise<OperationsData> {
  const rows = db
    .select()
    .from(adminActions)
    .orderBy(desc(adminActions.createdAt))
    .all()
  const accs = db.select().from(accounts).all()
  const accById = new Map(accs.map((a) => [a.id, a.name]))

  const map = (r: typeof adminActions.$inferSelect): AdminActionRow => ({
    id: r.id,
    type: r.type,
    status: r.status,
    requestedBy: r.requestedBy,
    approvedBy: r.approvedBy,
    targetAccountId: r.targetAccountId,
    targetAccountName: r.targetAccountId ? accById.get(r.targetAccountId) ?? null : null,
    params: r.params ? JSON.parse(r.params) : {},
    expiresAt: r.expiresAt?.getTime() ?? null,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  })

  const pending = rows.filter((r) => r.status === 'requested').map(map)
  const active = rows.filter((r) => r.status === 'approved' || r.status === 'executed').map(map)
  const history = rows.slice(0, 100).map(map)

  const byType: Record<AdminActionType, number> = {
    impersonation: 0,
    plan_override: 0,
    refund: 0,
    credit: 0,
    kill_switch: 0,
    flag_change: 0,
    gdpr: 0,
  }
  for (const r of rows) byType[r.type]++

  return { pending, active, history, byType }
}
