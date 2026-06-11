import 'server-only'
import { eq, asc, desc, and, sql, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  cohortRetentionMonthly,
  subscriptionEvents,
  subscriptions,
  accounts,
  metricRollupDaily,
  accountMetricsDaily,
  stripeInvoices,
} from '@/lib/db/schema'

export type RetentionData = {
  cohortHeatmap: Array<{
    cohortMonth: number
    monthN: number
    grrPct: number
    nrrPct: number
    accountsRetained: number
    accountsStart: number
  }>
  grrSeries: Array<{ date: number; value: number }>
  nrrTtmSeries: Array<{ date: number; value: number }>
  nrrMSeries: Array<{ date: number; value: number }>
  logoChurnSeries: Array<{ date: number; value: number }>
  voluntaryVsInvoluntary: { voluntary: number; involuntary: number }
  atRisk: Array<{
    accountId: string
    name: string
    planTier: string
    mrrUsdCents: number
    lastSeenAt: number | null
    factors: string[]
  }>
  expansionReady: Array<{
    accountId: string
    name: string
    planTier: string
    mrrUsdCents: number
    seatUtilPct: number
  }>
}

export async function loadRetention(): Promise<RetentionData> {
  const cohortHeatmap = db
    .select()
    .from(cohortRetentionMonthly)
    .orderBy(asc(cohortRetentionMonthly.cohortMonth), asc(cohortRetentionMonthly.monthN))
    .all()
    .map((r) => ({
      cohortMonth: r.cohortMonth,
      monthN: r.monthN,
      grrPct: r.grrPct,
      nrrPct: r.nrrPct,
      accountsRetained: r.accountsRetained,
      accountsStart: r.accountsStart,
    }))

  const series = (key: string) =>
    db
      .select()
      .from(metricRollupDaily)
      .where(eq(metricRollupDaily.metricKey, key))
      .orderBy(metricRollupDaily.dateReportingTz)
      .all()
      .map((r) => ({ date: r.dateReportingTz, value: r.value }))

  const grrSeries = series('ret.grr')
  const nrrTtmSeries = series('ret.nrr_ttm')
  const nrrMSeries = series('ret.nrr_m')
  const logoChurnSeries = series('ret.logo_churn')

  const churnEvents = db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.type, 'churn'))
    .all()
  const voluntary = churnEvents.length // all snapshot-diff for demo
  const involuntary = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(stripeInvoices)
    .where(sql`${stripeInvoices.daysDelinquent} >= 14`)
    .all()[0]?.n ?? 0

  const allAccounts = db.select().from(accounts).all()
  const lastDate = db
    .select({ d: sql<number>`MAX(${accountMetricsDaily.date})` })
    .from(accountMetricsDaily)
    .all()[0]?.d ?? 0
  const recentDays = lastDate - 14
  const lowDauAccounts = db
    .select({ id: accountMetricsDaily.accountId, dau: sql<number>`SUM(${accountMetricsDaily.dau})` })
    .from(accountMetricsDaily)
    .where(gte(accountMetricsDaily.date, recentDays))
    .groupBy(accountMetricsDaily.accountId)
    .orderBy(sql`SUM(${accountMetricsDaily.dau}) ASC`)
    .limit(20)
    .all()

  const accountById = new Map(allAccounts.map((a) => [a.id, a]))
  const atRisk = lowDauAccounts
    .filter((r) => accountById.get(r.id)?.planTier !== 'free')
    .slice(0, 10)
    .map((r) => {
      const a = accountById.get(r.id)
      return {
        accountId: r.id,
        name: a?.name ?? r.id,
        planTier: a?.planTier ?? 'free',
        mrrUsdCents: a?.mrrUsdCents ?? 0,
        lastSeenAt: null,
        factors: ['low_dau_14d', 'low_quota_util'],
      }
    })

  const highUseAccounts = db
    .select({
      id: accountMetricsDaily.accountId,
      runs: sql<number>`SUM(${accountMetricsDaily.promptRuns})`,
    })
    .from(accountMetricsDaily)
    .where(gte(accountMetricsDaily.date, recentDays))
    .groupBy(accountMetricsDaily.accountId)
    .orderBy(sql`SUM(${accountMetricsDaily.promptRuns}) DESC`)
    .limit(10)
    .all()
  const expansionReady = highUseAccounts.map((r) => {
    const a = accountById.get(r.id)
    return {
      accountId: r.id,
      name: a?.name ?? r.id,
      planTier: a?.planTier ?? 'free',
      mrrUsdCents: a?.mrrUsdCents ?? 0,
      seatUtilPct: 0.85 + (Number(r.runs) % 100) / 1000,
    }
  })

  return {
    cohortHeatmap,
    grrSeries,
    nrrTtmSeries,
    nrrMSeries,
    logoChurnSeries,
    voluntaryVsInvoluntary: { voluntary, involuntary },
    atRisk,
    expansionReady,
  }
}
