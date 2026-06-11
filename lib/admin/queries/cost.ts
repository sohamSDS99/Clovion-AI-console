import 'server-only'
import { sql, eq, gte, desc, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  llmCostLedger,
  pipelineRuns,
  subscriptions,
  accounts,
  opsSettings,
  accountMetricsDaily,
} from '@/lib/db/schema'

export type CostData = {
  spendByProvider: Array<{ provider: string; microcents: number }>
  spendByEngine: Array<{ engine: string; microcents: number }>
  spendByModel: Array<{ model: string; microcents: number }>
  spendByFeature: Array<{ feature: string; microcents: number }>
  topAccountsBySpend: Array<{
    accountId: string
    name: string
    planTier: string
    spendMicrocents: number
  }>
  ingestedVsInferred: { ingested: number; inferred: number }
  platformSharePct: number
  llmDailyBudgetCents: number
  totalSpendMicrocents: number
  freeBurnMicrocents: number
  negativeMarginAccounts: Array<{
    accountId: string
    name: string
    avgMarginCents: number
    daysNegative: number
  }>
}

export async function loadCost(): Promise<CostData> {
  const totalRow = db
    .select({ s: sql<number>`COALESCE(SUM(${llmCostLedger.costUsdMicrocents}), 0)` })
    .from(llmCostLedger)
    .all()[0]
  const totalSpendMicrocents = Number(totalRow?.s ?? 0)

  const spendByProvider = db
    .select({
      v: llmCostLedger.provider,
      s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})`,
    })
    .from(llmCostLedger)
    .groupBy(llmCostLedger.provider)
    .all()
    .map((r) => ({ provider: String(r.v), microcents: Number(r.s) }))

  const spendByEngine = db
    .select({
      v: llmCostLedger.engine,
      s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})`,
    })
    .from(llmCostLedger)
    .groupBy(llmCostLedger.engine)
    .all()
    .map((r) => ({ engine: String(r.v), microcents: Number(r.s) }))

  const spendByModel = db
    .select({
      v: llmCostLedger.model,
      s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})`,
    })
    .from(llmCostLedger)
    .groupBy(llmCostLedger.model)
    .all()
    .map((r) => ({ model: String(r.v), microcents: Number(r.s) }))

  const spendByFeature = db
    .select({
      v: llmCostLedger.feature,
      s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})`,
    })
    .from(llmCostLedger)
    .groupBy(llmCostLedger.feature)
    .all()
    .map((r) => ({ feature: String(r.v), microcents: Number(r.s) }))

  const acctRows = db
    .select({
      accountId: llmCostLedger.accountId,
      s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})`,
    })
    .from(llmCostLedger)
    .where(sql`${llmCostLedger.accountId} != '__platform__'`)
    .groupBy(llmCostLedger.accountId)
    .orderBy(sql`SUM(${llmCostLedger.costUsdMicrocents}) DESC`)
    .limit(20)
    .all()
  const allAccs = db.select().from(accounts).all()
  const accById = new Map(allAccs.map((a) => [a.id, a]))
  const topAccountsBySpend = acctRows.map((r) => {
    const a = accById.get(r.accountId)
    return {
      accountId: r.accountId,
      name: a?.name ?? r.accountId,
      planTier: a?.planTier ?? 'free',
      spendMicrocents: Number(r.s),
    }
  })

  const ingestedRow = db
    .select({ s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})` })
    .from(llmCostLedger)
    .where(eq(llmCostLedger.costSource, 'ingested'))
    .all()[0]
  const inferredRow = db
    .select({ s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})` })
    .from(llmCostLedger)
    .where(eq(llmCostLedger.costSource, 'inferred'))
    .all()[0]
  const ingestedVsInferred = {
    ingested: Number(ingestedRow?.s ?? 0),
    inferred: Number(inferredRow?.s ?? 0),
  }

  const platformRow = db
    .select({ s: sql<number>`SUM(${llmCostLedger.costUsdMicrocents})` })
    .from(llmCostLedger)
    .where(eq(llmCostLedger.accountId, '__platform__'))
    .all()[0]
  const platformShare = Number(platformRow?.s ?? 0)
  const platformSharePct = totalSpendMicrocents
    ? platformShare / totalSpendMicrocents
    : 0

  const budgetRow = db
    .select()
    .from(opsSettings)
    .where(eq(opsSettings.key, 'llm_daily_budget_usd_cents'))
    .limit(1)
    .all()[0]
  const llmDailyBudgetCents = budgetRow ? Number(JSON.parse(budgetRow.value)) : 50000

  const freeAcctIds = allAccs.filter((a) => a.planTier === 'free').map((a) => a.id)
  let freeBurnMicrocents = 0
  if (freeAcctIds.length > 0) {
    const placeholders = freeAcctIds.map(() => '?').join(',')
    const stmt = db.$client.prepare(
      `SELECT COALESCE(SUM(cost_usd_microcents), 0) AS s FROM llm_cost_ledger WHERE account_id IN (${placeholders})`
    )
    const r = stmt.get(...freeAcctIds) as { s: number }
    freeBurnMicrocents = Number(r?.s ?? 0)
  }

  const negRows = db
    .select({
      accountId: accountMetricsDaily.accountId,
      avg: sql<number>`AVG(${accountMetricsDaily.marginUsdCents})`,
      neg: sql<number>`SUM(CASE WHEN ${accountMetricsDaily.marginUsdCents} < 0 THEN 1 ELSE 0 END)`,
    })
    .from(accountMetricsDaily)
    .groupBy(accountMetricsDaily.accountId)
    .orderBy(sql`AVG(${accountMetricsDaily.marginUsdCents}) ASC`)
    .limit(20)
    .all()
  const negativeMarginAccounts = negRows
    .filter((r) => Number(r.avg) < 0)
    .map((r) => {
      const a = accById.get(r.accountId)
      return {
        accountId: r.accountId,
        name: a?.name ?? r.accountId,
        avgMarginCents: Math.round(Number(r.avg)),
        daysNegative: Number(r.neg),
      }
    })

  return {
    spendByProvider,
    spendByEngine,
    spendByModel,
    spendByFeature,
    topAccountsBySpend,
    ingestedVsInferred,
    platformSharePct,
    llmDailyBudgetCents,
    totalSpendMicrocents,
    freeBurnMicrocents,
    negativeMarginAccounts,
  }
}
