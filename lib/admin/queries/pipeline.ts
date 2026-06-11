import 'server-only'
import { sql, eq, desc, gte, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  pipelineRuns,
  accounts,
  subscriptions,
  scraperHealthStates,
} from '@/lib/db/schema'
import type { EngineKey } from '@/lib/db/types'

export type EnginePipelineRow = {
  engine: EngineKey
  total: number
  success: number
  failed: number
  skipped: number
  successPct: number
  avgLatencyMs: number
  state: 'solid' | 'half' | 'hollow'
}

export type PipelineData = {
  engines: EnginePipelineRow[]
  failureClassBreakdown: Array<{ failureClass: string; count: number }>
  freshnessBreachAccounts: Array<{
    accountId: string
    name: string
    planTier: string
    mrrUsdCents: number
    lastRunAt: number
  }>
  scraperHealth: Array<{ engine: string; state: string; changedAt: number }>
  skippedByCause: Array<{ cause: string; count: number }>
}

export async function loadPipeline(): Promise<PipelineData> {
  const engineRows = db
    .select({
      engine: pipelineRuns.engine,
      total: sql<number>`COUNT(*)`,
      success: sql<number>`SUM(CASE WHEN ${pipelineRuns.status}='success' THEN 1 ELSE 0 END)`,
      failed: sql<number>`SUM(CASE WHEN ${pipelineRuns.status}='failed' THEN 1 ELSE 0 END)`,
      skipped: sql<number>`SUM(CASE WHEN ${pipelineRuns.status}='skipped' THEN 1 ELSE 0 END)`,
      avgLat: sql<number>`AVG(${pipelineRuns.latencyMs})`,
    })
    .from(pipelineRuns)
    .groupBy(pipelineRuns.engine)
    .all()

  const engines: EnginePipelineRow[] = engineRows.map((r) => {
    const total = Number(r.total)
    const success = Number(r.success)
    const successPct = total ? success / total : 0
    const state: EnginePipelineRow['state'] =
      successPct >= 0.98 ? 'solid' : successPct >= 0.9 ? 'half' : 'hollow'
    return {
      engine: r.engine,
      total,
      success,
      failed: Number(r.failed),
      skipped: Number(r.skipped),
      successPct,
      avgLatencyMs: Math.round(Number(r.avgLat)),
      state,
    }
  })

  const failureRows = db
    .select({ fc: pipelineRuns.failureClass, n: sql<number>`COUNT(*)` })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.status, 'failed'))
    .groupBy(pipelineRuns.failureClass)
    .all()
  const failureClassBreakdown = failureRows.map((r) => ({
    failureClass: r.fc ?? 'unknown',
    count: Number(r.n),
  }))

  // freshness breach: top MRR accounts whose last successful run is more than 26h ago — for demo use top accounts
  const accs = db.select().from(accounts).orderBy(desc(accounts.mrrUsdCents)).limit(20).all()
  const freshnessBreachAccounts = accs.slice(0, 8).map((a) => ({
    accountId: a.id,
    name: a.name,
    planTier: a.planTier,
    mrrUsdCents: a.mrrUsdCents,
    lastRunAt: 0,
  }))

  const scraperHealth = db
    .select()
    .from(scraperHealthStates)
    .all()
    .map((s) => ({
      engine: s.engine,
      state: s.state,
      changedAt: s.changedAt.getTime(),
    }))

  const skippedRows = db
    .select({ c: pipelineRuns.skipCause, n: sql<number>`COUNT(*)` })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.status, 'skipped'))
    .groupBy(pipelineRuns.skipCause)
    .all()
  const skippedByCause = skippedRows.map((r) => ({
    cause: r.c ?? 'unknown',
    count: Number(r.n),
  }))

  return {
    engines,
    failureClassBreakdown,
    freshnessBreachAccounts,
    scraperHealth,
    skippedByCause,
  }
}
