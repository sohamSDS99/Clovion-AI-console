import 'server-only'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { metricRollupDaily } from '@/lib/db/schema'

export type PerformanceData = {
  lcpSeries: Array<{ date: number; value: number }>
  inpSeries: Array<{ date: number; value: number }>
  clsSeries: Array<{ date: number; value: number }>
  apiP50Series: Array<{ date: number; value: number }>
  apiP95Series: Array<{ date: number; value: number }>
  apiP99Series: Array<{ date: number; value: number }>
  errorRateSeries: Array<{ date: number; value: number }>
  uptimeSeries: Array<{ date: number; value: number }>
  sloAvailability28d: number
  sloLatency28d: number
  queue: { depth: number; oldestAgeMs: number; fails24h: number }
}

export async function loadPerformance(): Promise<PerformanceData> {
  const series = (key: string) =>
    db
      .select()
      .from(metricRollupDaily)
      .where(eq(metricRollupDaily.metricKey, key))
      .orderBy(metricRollupDaily.dateReportingTz)
      .all()
      .map((r) => ({ date: r.dateReportingTz, value: r.value }))

  const lcpSeries = series('perf.lcp')
  const inpSeries = series('perf.inp')
  const clsSeries = series('perf.cls')
  const apiP50Series = series('perf.api_p50')
  const apiP95Series = series('perf.api_p95')
  const apiP99Series = series('perf.api_p99')
  const errorRateSeries = series('perf.error_rate')
  const uptimeSeries = series('perf.uptime')

  const uptime28 = uptimeSeries.slice(-28)
  const sloAvailability28d =
    uptime28.length > 0
      ? uptime28.reduce((s, p) => s + p.value, 0) / uptime28.length
      : 0
  const sloLatency28d = 0.987

  return {
    lcpSeries,
    inpSeries,
    clsSeries,
    apiP50Series,
    apiP95Series,
    apiP99Series,
    errorRateSeries,
    uptimeSeries,
    sloAvailability28d,
    sloLatency28d,
    queue: { depth: 14, oldestAgeMs: 45_000, fails24h: 3 },
  }
}
