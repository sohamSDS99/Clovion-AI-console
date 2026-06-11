import 'server-only'
import { asc, eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { gdprRequests } from '@/lib/db/schema'

export type GdprRow = {
  id: string
  type: 'delete' | 'export'
  accountId: string | null
  userId: string | null
  receivedAt: number
  deadlineAt: number
  daysToDeadline: number
  status: string
  steps: Array<{ step: string; done: boolean }>
  completedAt: number | null
}

export type GdprData = {
  open: GdprRow[]
  completed: GdprRow[]
}

export async function loadGdpr(now = 1717977600000): Promise<GdprData> {
  const rows = db
    .select()
    .from(gdprRequests)
    .orderBy(asc(gdprRequests.deadlineAt))
    .all()
  const map = (r: typeof gdprRequests.$inferSelect): GdprRow => ({
    id: r.id,
    type: r.type,
    accountId: r.accountId,
    userId: r.userId,
    receivedAt: r.receivedAt.getTime(),
    deadlineAt: r.deadlineAt.getTime(),
    daysToDeadline: Math.floor((r.deadlineAt.getTime() - now) / 86_400_000),
    status: r.status,
    steps: r.steps ? JSON.parse(r.steps) : [],
    completedAt: r.completedAt?.getTime() ?? null,
  })

  return {
    open: rows.filter((r) => r.status !== 'completed').map(map),
    completed: rows.filter((r) => r.status === 'completed').map(map),
  }
}
