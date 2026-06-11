import 'server-only'
import { eq, desc, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  metricRollupDaily,
  alerts,
  syncWatermarks,
  opsSettings,
  subscriptions,
} from '@/lib/db/schema'
import { loadFreshness } from '@/lib/admin/metrics/freshness'

export type KpiTile = {
  key: string
  value: number
  numerator?: number
  denominator?: number
  anchor?: boolean
}

export type SeriesPoint = { date: number; value: number }

export type TrendSeries = {
  mrr: SeriesPoint[]
  dau: SeriesPoint[]
  pipelineSpend: SeriesPoint[]
}

export type MrrByTier = Array<{ tier: string; mrr: number; accounts: number }>

export type CommandCenterData = {
  anchors: KpiTile[]
  tiles: KpiTile[]
  openAlerts: Array<{
    id: string
    metricKey: string
    severity: string
    firedAt: number
    ownerRole: string
  }>
  freshness: Awaited<ReturnType<typeof loadFreshness>>
  llmBudgetCents: number
  trend60d: TrendSeries
  mrrByTier: MrrByTier
}

async function latest(key: string): Promise<KpiTile | null> {
  const row = db
    .select()
    .from(metricRollupDaily)
    .where(eq(metricRollupDaily.metricKey, key))
    .orderBy(desc(metricRollupDaily.dateReportingTz))
    .limit(1)
    .all()[0]
  if (!row) return null
  return {
    key,
    value: row.value,
    numerator: row.numerator,
    denominator: row.denominator,
  }
}

function loadSeries(key: string, n: number): SeriesPoint[] {
  return db
    .select()
    .from(metricRollupDaily)
    .where(eq(metricRollupDaily.metricKey, key))
    .orderBy(metricRollupDaily.dateReportingTz)
    .all()
    .map((r) => ({ date: r.dateReportingTz, value: r.value }))
    .slice(-n)
}

export async function loadCommandCenter(): Promise<CommandCenterData> {
  const anchorKeys = ['ret.nrr_ttm', 'rev.cac_payback']
  const tileKeys = [
    'rev.mrr',
    'acq.signups',
    'rev.trial_cvr',
    'eng.dau',
    'eng.stick_wm',
    'ret.logo_churn',
    'ai.run_success',
    'ai.spend',
    'ai.margin',
    'rev.delinquent',
    'perf.api_p95',
    'perf.uptime',
  ]

  const anchors: KpiTile[] = []
  for (const k of anchorKeys) {
    const t = await latest(k)
    if (t) anchors.push({ ...t, anchor: true })
  }
  const tiles: KpiTile[] = []
  for (const k of tileKeys) {
    const t = await latest(k)
    if (t) tiles.push(t)
  }

  const openAlerts = db
    .select()
    .from(alerts)
    .where(eq(alerts.status, 'open'))
    .orderBy(desc(alerts.firedAt))
    .limit(10)
    .all()
    .map((a) => ({
      id: a.id,
      metricKey: a.metricKey,
      severity: a.severity,
      firedAt: a.firedAt.getTime(),
      ownerRole: a.ownerRole,
    }))

  const freshness = await loadFreshness()

  const budgetRow = db
    .select()
    .from(opsSettings)
    .where(eq(opsSettings.key, 'llm_daily_budget_usd_cents'))
    .limit(1)
    .all()[0]
  const llmBudgetCents = budgetRow ? Number(JSON.parse(budgetRow.value)) : 50000

  // 60d trend series for MultiLine
  const trend60d: TrendSeries = {
    mrr: loadSeries('rev.mrr', 60),
    dau: loadSeries('eng.dau', 60),
    pipelineSpend: loadSeries('ai.spend', 60),
  }

  // MRR by plan tier (active subscriptions, in cents)
  const tierRows = db
    .select({
      tier: subscriptions.planTier,
      mrr: sql<number>`COALESCE(SUM(${subscriptions.mrrUsdCents}), 0)`,
      n: sql<number>`COUNT(*)`,
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'))
    .groupBy(subscriptions.planTier)
    .all()
  const mrrByTier: MrrByTier = tierRows.map((t) => ({
    tier: t.tier,
    mrr: Number(t.mrr),
    accounts: Number(t.n),
  }))

  return {
    anchors,
    tiles,
    openAlerts,
    freshness,
    llmBudgetCents,
    trend60d,
    mrrByTier,
  }
}
