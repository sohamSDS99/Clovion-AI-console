import 'server-only'
import { desc, eq, gte, sql, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  metricRollupDaily,
  usageEvents,
  channelSpend,
  companyInputsQuarterly,
} from '@/lib/db/schema'

export type Timeseries = { date: number; value: number }[]

export type AcquisitionData = {
  signupsSeries: Timeseries
  visitorsSeries: Timeseries
  sessionsSeries: Timeseries
  channelTable: Array<{ channel: string; spendUsdCents: number; month: string }>
  signupFunnel: Array<{ step: string; count: number }>
  cacRatioHistory: Array<{ quarter: string; cacRatio: number }>
  totalSignups30d: number
  totalSignups7d: number
}

export async function loadAcquisition(): Promise<AcquisitionData> {
  const series = (key: string): Timeseries =>
    db
      .select()
      .from(metricRollupDaily)
      .where(eq(metricRollupDaily.metricKey, key))
      .orderBy(metricRollupDaily.dateReportingTz)
      .all()
      .map((r) => ({ date: r.dateReportingTz, value: r.value }))

  const signupsSeries = series('acq.signups')
  const visitorsSeries = series('acq.visitors')
  const sessionsSeries = series('acq.sessions')

  const channelTable = db
    .select()
    .from(channelSpend)
    .orderBy(desc(channelSpend.month))
    .all()
    .map((c) => ({
      channel: c.channel,
      spendUsdCents: c.spendUsdCents,
      month: c.month,
    }))

  const signupFunnelRows = db
    .select({
      step: usageEvents.eventName,
      count: sql<number>`COUNT(*)`,
    })
    .from(usageEvents)
    .where(
      sql`${usageEvents.eventName} IN ('page_viewed','score_requested','score_completed','user_signed_up')`
    )
    .groupBy(usageEvents.eventName)
    .all()
  const signupFunnel = ['page_viewed', 'score_requested', 'score_completed', 'user_signed_up'].map(
    (s) => ({
      step: s,
      count: Number(signupFunnelRows.find((r) => r.step === s)?.count ?? 0),
    })
  )

  const quarters = db.select().from(companyInputsQuarterly).all()
  const cacRatioHistory = quarters.map((q) => ({
    quarter: q.quarter,
    cacRatio: q.smExpenseUsdCents / Math.max(1, q.smExpenseUsdCents / 2),
  }))

  const last30 = signupsSeries.slice(-30).reduce((s, p) => s + p.value, 0)
  const last7 = signupsSeries.slice(-7).reduce((s, p) => s + p.value, 0)

  return {
    signupsSeries,
    visitorsSeries,
    sessionsSeries,
    channelTable,
    signupFunnel,
    cacRatioHistory,
    totalSignups30d: last30,
    totalSignups7d: last7,
  }
}
