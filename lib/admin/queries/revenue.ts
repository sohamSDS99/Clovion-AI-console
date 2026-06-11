import 'server-only'
import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  subscriptionEvents,
  subscriptions,
  stripeInvoices,
  metricRollupDaily,
  accounts,
} from '@/lib/db/schema'

export type RevenueData = {
  mrrSeries: Array<{ date: number; value: number }>
  waterfall: {
    startMrr: number
    newMrr: number
    expansionMrr: number
    reactivationMrr: number
    contractionMrr: number
    churnMrr: number
    discountMrr: number
    endMrr: number
  }
  arpaByTier: Array<{ tier: string; arpa: number; accounts: number }>
  delinquentMrr: number
  dunningQueue: Array<{
    id: string
    accountId: string
    accountName: string
    amountUsdCents: number
    attemptCount: number
    daysDelinquent: number
    nextPaymentAttempt: number | null
  }>
  trialCvrSeries: Array<{ date: number; value: number }>
  cacPaybackSeries: Array<{ date: number; value: number }>
}

export async function loadRevenue(): Promise<RevenueData> {
  const series = (key: string) =>
    db
      .select()
      .from(metricRollupDaily)
      .where(eq(metricRollupDaily.metricKey, key))
      .orderBy(metricRollupDaily.dateReportingTz)
      .all()
      .map((r) => ({ date: r.dateReportingTz, value: r.value }))

  const mrrSeries = series('rev.mrr')
  const trialCvrSeries = series('rev.trial_cvr')
  const cacPaybackSeries = series('rev.cac_payback')

  const sum = (type: string) => {
    const r = db
      .select({ s: sql<number>`COALESCE(SUM(${subscriptionEvents.mrrDeltaUsdCents}), 0)` })
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.type, type as 'new'))
      .all()[0]
    return Number(r?.s ?? 0)
  }
  const newMrr = sum('new')
  const expansionMrr = sum('expansion')
  const reactivationMrr = sum('reactivation')
  const contractionMrr = -sum('contraction')
  const churnMrr = -sum('churn')
  const discountMrr = sum('discount_change')
  const startMrr = mrrSeries.length > 0 ? mrrSeries[0].value : 0
  const endMrr = mrrSeries.length > 0 ? mrrSeries[mrrSeries.length - 1].value : 0

  // ARPA by tier
  const tierRows = db
    .select({ tier: subscriptions.planTier, mrr: sql<number>`SUM(${subscriptions.mrrUsdCents})`, n: sql<number>`COUNT(*)` })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'))
    .groupBy(subscriptions.planTier)
    .all()
  const arpaByTier = tierRows.map((t) => ({
    tier: t.tier,
    arpa: Number(t.mrr) / Math.max(1, Number(t.n)),
    accounts: Number(t.n),
  }))

  const delinquentMrrRow = db
    .select({ s: sql<number>`COALESCE(SUM(${stripeInvoices.amountUsdCents}), 0)` })
    .from(stripeInvoices)
    .where(eq(stripeInvoices.status, 'open'))
    .all()[0]
  const delinquentMrr = Number(delinquentMrrRow?.s ?? 0)

  const allAccounts = db.select().from(accounts).all()
  const accById = new Map(allAccounts.map((a) => [a.id, a]))
  const dunningQueue = db
    .select()
    .from(stripeInvoices)
    .where(eq(stripeInvoices.status, 'open'))
    .orderBy(desc(stripeInvoices.daysDelinquent))
    .limit(20)
    .all()
    .map((i) => ({
      id: i.id,
      accountId: i.accountId,
      accountName: accById.get(i.accountId)?.name ?? i.accountId,
      amountUsdCents: i.amountUsdCents,
      attemptCount: i.attemptCount,
      daysDelinquent: i.daysDelinquent,
      nextPaymentAttempt: i.nextPaymentAttempt?.getTime() ?? null,
    }))

  return {
    mrrSeries,
    waterfall: {
      startMrr,
      newMrr,
      expansionMrr,
      reactivationMrr,
      contractionMrr,
      churnMrr,
      discountMrr,
      endMrr,
    },
    arpaByTier,
    delinquentMrr,
    dunningQueue,
    trialCvrSeries,
    cacPaybackSeries,
  }
}
