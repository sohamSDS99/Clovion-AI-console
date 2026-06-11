import 'server-only'
import { eq, desc, sql, and, like, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  users,
  workspaces,
  subscriptions,
  accountMetricsDaily,
  pipelineRuns,
  llmCostLedger,
  supportTicketsMirror,
  npsResponses,
  subscriptionEvents,
  adminActions,
  stripeInvoices,
} from '@/lib/db/schema'

export type AccountListRow = {
  id: string
  name: string
  type: string
  planTier: string
  status: string
  mrrUsdCents: number
  lastSeenAt: number | null
  workspaceCount: number
  churnRiskScore: number
  marginUsdCents: number
}

export async function loadAccountList(
  q?: string,
  sortBy: 'mrr' | 'created' | 'name' = 'mrr'
): Promise<AccountListRow[]> {
  let rows = db.select().from(accounts).all()
  if (q && q.trim()) {
    const needle = q.trim().toLowerCase()
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle)
    )
  }
  if (sortBy === 'mrr') rows.sort((a, b) => b.mrrUsdCents - a.mrrUsdCents)
  else if (sortBy === 'created') rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  else rows.sort((a, b) => a.name.localeCompare(b.name))

  // join last 14d margin per account
  const lastDate = db
    .select({ d: sql<number>`MAX(${accountMetricsDaily.date})` })
    .from(accountMetricsDaily)
    .all()[0]?.d ?? 0
  const recentDays = lastDate - 14
  const marginRows = db
    .select({
      accountId: accountMetricsDaily.accountId,
      m: sql<number>`AVG(${accountMetricsDaily.marginUsdCents})`,
    })
    .from(accountMetricsDaily)
    .where(gte(accountMetricsDaily.date, recentDays))
    .groupBy(accountMetricsDaily.accountId)
    .all()
  const marginById = new Map(
    marginRows.map((m) => [m.accountId, Math.round(Number(m.m))])
  )

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    planTier: r.planTier,
    status: r.status,
    mrrUsdCents: r.mrrUsdCents,
    lastSeenAt: null,
    workspaceCount: r.workspaceCount,
    churnRiskScore: r.status === 'churned' ? 100 : (r.mrrUsdCents > 0 ? 25 : 0),
    marginUsdCents: marginById.get(r.id) ?? 0,
  }))
}

export type Account360 = {
  account: typeof accounts.$inferSelect
  users: Array<typeof users.$inferSelect>
  workspaces: Array<typeof workspaces.$inferSelect>
  subscription: typeof subscriptions.$inferSelect | null
  dauSparkline: Array<{ date: number; dau: number }>
  promptRuns30d: number
  spendMicrocents30d: number
  marginCents30d: number
  tickets: Array<typeof supportTicketsMirror.$inferSelect>
  nps: Array<typeof npsResponses.$inferSelect>
  subEvents: Array<typeof subscriptionEvents.$inferSelect>
  adminActions: Array<typeof adminActions.$inferSelect>
  invoices: Array<typeof stripeInvoices.$inferSelect>
  pipelinePerEngine: Array<{
    engine: string
    total: number
    success: number
    successPct: number
    lastRunAt: number | null
  }>
}

export async function loadAccount360(id: string): Promise<Account360 | null> {
  const a = db.select().from(accounts).where(eq(accounts.id, id)).limit(1).all()[0]
  if (!a) return null

  const us = db.select().from(users).where(eq(users.accountId, id)).all()
  const ws = db.select().from(workspaces).where(eq(workspaces.accountId, id)).all()
  const sub = db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.accountId, id))
    .limit(1)
    .all()[0] ?? null

  const dauSparkline = db
    .select({ date: accountMetricsDaily.date, dau: accountMetricsDaily.dau })
    .from(accountMetricsDaily)
    .where(eq(accountMetricsDaily.accountId, id))
    .orderBy(accountMetricsDaily.date)
    .all()
    .map((r) => ({ date: r.date, dau: r.dau }))

  const lastDate = db
    .select({ d: sql<number>`MAX(${accountMetricsDaily.date})` })
    .from(accountMetricsDaily)
    .all()[0]?.d ?? 0
  const cutoff = lastDate - 30
  const last30 = db
    .select({
      runs: sql<number>`SUM(${accountMetricsDaily.promptRuns})`,
      spend: sql<number>`SUM(${accountMetricsDaily.tokenCostUsdMicrocents})`,
      margin: sql<number>`SUM(${accountMetricsDaily.marginUsdCents})`,
    })
    .from(accountMetricsDaily)
    .where(
      and(eq(accountMetricsDaily.accountId, id), gte(accountMetricsDaily.date, cutoff))
    )
    .all()[0]

  const tickets = db
    .select()
    .from(supportTicketsMirror)
    .where(eq(supportTicketsMirror.accountId, id))
    .orderBy(desc(supportTicketsMirror.createdAt))
    .limit(20)
    .all()

  const nps = db
    .select()
    .from(npsResponses)
    .where(eq(npsResponses.accountId, id))
    .orderBy(desc(npsResponses.surveyedAt))
    .limit(10)
    .all()

  const subEvts = db
    .select()
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.accountId, id))
    .orderBy(desc(subscriptionEvents.occurredAt))
    .all()

  const aas = db
    .select()
    .from(adminActions)
    .where(eq(adminActions.targetAccountId, id))
    .orderBy(desc(adminActions.createdAt))
    .all()

  const invs = db
    .select()
    .from(stripeInvoices)
    .where(eq(stripeInvoices.accountId, id))
    .orderBy(desc(stripeInvoices.createdAt))
    .all()

  const pplnRows = db
    .select({
      engine: pipelineRuns.engine,
      total: sql<number>`COUNT(*)`,
      success: sql<number>`SUM(CASE WHEN ${pipelineRuns.status}='success' THEN 1 ELSE 0 END)`,
      last: sql<number>`MAX(${pipelineRuns.scheduledFor})`,
    })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.accountId, id))
    .groupBy(pipelineRuns.engine)
    .all()
  const pipelinePerEngine = pplnRows.map((r) => {
    const total = Number(r.total)
    const success = Number(r.success)
    return {
      engine: r.engine,
      total,
      success,
      successPct: total ? success / total : 0,
      lastRunAt: r.last ? Number(r.last) : null,
    }
  })

  return {
    account: a,
    users: us,
    workspaces: ws,
    subscription: sub,
    dauSparkline,
    promptRuns30d: Number(last30?.runs ?? 0),
    spendMicrocents30d: Number(last30?.spend ?? 0),
    marginCents30d: Number(last30?.margin ?? 0),
    tickets,
    nps,
    subEvents: subEvts,
    adminActions: aas,
    invoices: invs,
    pipelinePerEngine,
  }
}
