import 'server-only'
import { desc, eq, sql, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { alerts } from '@/lib/db/schema'

export type AlertRow = {
  id: string
  metricKey: string
  severity: string
  status: string
  firedAt: number
  ackedAt: number | null
  resolvedAt: number | null
  ownerRole: string
  zScore: number | null
  threshold: number | null
}

export type AlertsData = {
  open: AlertRow[]
  history: AlertRow[]
  precisionLast30d: {
    truePositives: number
    falsePositives: number
    precision: number
  }
}

export async function loadAlerts(): Promise<AlertsData> {
  const map = (a: typeof alerts.$inferSelect): AlertRow => ({
    id: a.id,
    metricKey: a.metricKey,
    severity: a.severity,
    status: a.status,
    firedAt: a.firedAt.getTime(),
    ackedAt: a.ackedAt?.getTime() ?? null,
    resolvedAt: a.resolvedAt?.getTime() ?? null,
    ownerRole: a.ownerRole,
    zScore: a.zScore,
    threshold: a.threshold,
  })

  const open = db
    .select()
    .from(alerts)
    .where(eq(alerts.status, 'open'))
    .orderBy(desc(alerts.firedAt))
    .all()
    .map(map)

  const history = db
    .select()
    .from(alerts)
    .orderBy(desc(alerts.firedAt))
    .limit(200)
    .all()
    .map(map)

  const resolved = history.filter((a) => a.status === 'resolved')
  const truePositives = resolved.filter((a) => a.severity !== 'info').length
  const falsePositives = resolved.length - truePositives
  const precision = resolved.length ? truePositives / resolved.length : 0

  return {
    open,
    history,
    precisionLast30d: { truePositives, falsePositives, precision },
  }
}
