import 'server-only'
import { and, eq, sql, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  metricRollupDaily,
  accountMetricsDaily,
  accounts,
  usageEvents,
} from '@/lib/db/schema'

export type EngagementData = {
  dauSeries: Array<{ date: number; value: number }>
  acctDauSeries: Array<{ date: number; value: number }>
  stickWmSeries: Array<{ date: number; value: number }>
  stickDmSeries: Array<{ date: number; value: number }>
  topAccounts: Array<{
    accountId: string
    name: string
    planTier: string
    avgDau: number
    promptRuns30d: number
  }>
  /** Per-feature per-day usage counts for last 28d. */
  featureDayMatrix: {
    days: Array<{ key: string; label: string }>
    features: Array<{ key: string; label: string }>
    values: Array<{ row: string; col: string; value: number }>
  }
}

// Value-event features tracked on the engagement matrix.
const FEATURE_EVENT_MAP: Array<{ key: string; label: string; events: string[] }> = [
  { key: 'dashboards', label: 'DASHBOARDS', events: ['dashboard_viewed'] },
  { key: 'reports', label: 'REPORTS', events: ['report_viewed'] },
  { key: 'exports', label: 'EXPORTS', events: ['report_exported'] },
  { key: 'prompts', label: 'PROMPTS', events: ['prompt_created'] },
  { key: 'engines', label: 'ENGINES', events: ['engine_connected'] },
  { key: 'alerts', label: 'ALERTS', events: ['alert_configured'] },
  { key: 'features', label: 'FEATURES', events: ['feature_used'] },
  { key: 'api', label: 'API', events: ['api_used'] },
  { key: 'mcp', label: 'MCP', events: ['mcp_used'] },
]

const DAY_MS = 24 * 60 * 60 * 1000

export async function loadEngagement(): Promise<EngagementData> {
  const series = (key: string) =>
    db
      .select()
      .from(metricRollupDaily)
      .where(eq(metricRollupDaily.metricKey, key))
      .orderBy(metricRollupDaily.dateReportingTz)
      .all()
      .map((r) => ({ date: r.dateReportingTz, value: r.value }))

  const dauSeries = series('eng.dau')
  const acctDauSeries = series('eng.acct_dau')
  const stickWmSeries = series('eng.stick_wm')
  const stickDmSeries = series('eng.stick_dm')

  const topRows = db
    .select({
      accountId: accountMetricsDaily.accountId,
      avgDau: sql<number>`AVG(${accountMetricsDaily.dau})`,
      runs: sql<number>`SUM(${accountMetricsDaily.promptRuns})`,
    })
    .from(accountMetricsDaily)
    .groupBy(accountMetricsDaily.accountId)
    .orderBy(sql`AVG(${accountMetricsDaily.dau}) DESC`)
    .limit(20)
    .all()

  const allAccounts = db.select().from(accounts).all()
  const byId = new Map(allAccounts.map((a) => [a.id, a]))
  const topAccounts = topRows.map((r) => {
    const a = byId.get(r.accountId)
    return {
      accountId: r.accountId,
      name: a?.name ?? r.accountId,
      planTier: a?.planTier ?? 'free',
      avgDau: Number(r.avgDau),
      promptRuns30d: Number(r.runs),
    }
  })

  // --- Feature × Day matrix (last 28d) -------------------------------------
  // Anchor on the most recent DAU date so the heatmap aligns with seeded data
  // (seed timestamps may be earlier than "today"). Fall back to wall clock.
  const anchorDate =
    dauSeries.length > 0
      ? new Date(dauSeries[dauSeries.length - 1].date)
      : new Date()
  const anchor = Date.UTC(
    anchorDate.getUTCFullYear(),
    anchorDate.getUTCMonth(),
    anchorDate.getUTCDate(),
  )
  const startMs = anchor - 27 * DAY_MS

  // Build 28 day buckets (oldest -> newest)
  const days: Array<{ key: string; label: string }> = []
  for (let i = 0; i < 28; i++) {
    const t = startMs + i * DAY_MS
    const d = new Date(t)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    const label = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
    days.push({ key, label })
  }

  const allEvents = FEATURE_EVENT_MAP.flatMap((f) => f.events)
  const eventRows = db
    .select({
      eventName: usageEvents.eventName,
      occurredAt: usageEvents.occurredAt,
    })
    .from(usageEvents)
    .where(
      and(
        inArray(usageEvents.eventName, allEvents),
        gte(usageEvents.occurredAt, new Date(startMs)),
      ),
    )
    .all()

  // Reverse-lookup event -> feature key.
  const eventToFeature = new Map<string, string>()
  for (const f of FEATURE_EVENT_MAP) {
    for (const e of f.events) eventToFeature.set(e, f.key)
  }

  // Build aggregate map: featureKey|dayKey -> count.
  const counts = new Map<string, number>()
  for (const row of eventRows) {
    const t = row.occurredAt instanceof Date ? row.occurredAt.getTime() : Number(row.occurredAt)
    if (t < startMs || t > anchor + DAY_MS) continue
    const dayIdx = Math.floor((t - startMs) / DAY_MS)
    if (dayIdx < 0 || dayIdx >= days.length) continue
    const feature = eventToFeature.get(row.eventName)
    if (!feature) continue
    const k = `${feature}|${days[dayIdx].key}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  const values = Array.from(counts.entries()).map(([k, value]) => {
    const [row, col] = k.split('|')
    return { row, col, value }
  })

  return {
    dauSeries,
    acctDauSeries,
    stickWmSeries,
    stickDmSeries,
    topAccounts,
    featureDayMatrix: {
      days,
      features: FEATURE_EVENT_MAP.map((f) => ({ key: f.key, label: f.label })),
      values,
    },
  }
}
