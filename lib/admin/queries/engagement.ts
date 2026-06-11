import 'server-only'
import { eq, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  metricRollupDaily,
  accountMetricsDaily,
  accounts,
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
}

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

  return { dauSeries, acctDauSeries, stickWmSeries, stickDmSeries, topAccounts }
}
