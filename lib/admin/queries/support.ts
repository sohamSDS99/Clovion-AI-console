import 'server-only'
import { sql, desc, gte, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { supportTicketsMirror, npsResponses, metricRollupDaily } from '@/lib/db/schema'

export type SupportData = {
  ticketsSeries: Array<{ date: number; value: number }>
  frtSeries: Array<{ date: number; value: number }>
  csatSeries: Array<{ date: number; value: number }>
  backlogByAge: Array<{ bucket: string; count: number }>
  byPriority: Array<{ priority: string; count: number }>
  nps: {
    score: number
    responses: number
    promoters: number
    passives: number
    detractors: number
    verbatims: Array<{ score: number; comment: string }>
  }
}

export async function loadSupport(): Promise<SupportData> {
  const series = (key: string) =>
    db
      .select()
      .from(metricRollupDaily)
      .where(eq(metricRollupDaily.metricKey, key))
      .orderBy(metricRollupDaily.dateReportingTz)
      .all()
      .map((r) => ({ date: r.dateReportingTz, value: r.value }))

  const ticketsSeries = series('sup.tickets')
  const frtSeries = series('sup.frt')
  const csatSeries = series('sup.csat')

  // backlog by age (open tickets)
  const now = 1717977600000
  const open = db
    .select()
    .from(supportTicketsMirror)
    .where(eq(supportTicketsMirror.status, 'open'))
    .all()
  const ageBuckets = { '<1d': 0, '1-3d': 0, '3-7d': 0, '>7d': 0 }
  for (const t of open) {
    const ageH = (now - t.createdAt.getTime()) / 3_600_000
    if (ageH < 24) ageBuckets['<1d']++
    else if (ageH < 72) ageBuckets['1-3d']++
    else if (ageH < 168) ageBuckets['3-7d']++
    else ageBuckets['>7d']++
  }
  const backlogByAge = Object.entries(ageBuckets).map(([bucket, count]) => ({
    bucket,
    count,
  }))

  const priRows = db
    .select({ p: supportTicketsMirror.priority, n: sql<number>`COUNT(*)` })
    .from(supportTicketsMirror)
    .groupBy(supportTicketsMirror.priority)
    .all()
  const byPriority = priRows.map((r) => ({
    priority: r.p,
    count: Number(r.n),
  }))

  const npsRows = db.select().from(npsResponses).all()
  const responses = npsRows.length
  const promoters = npsRows.filter((r) => r.score >= 9).length
  const passives = npsRows.filter((r) => r.score >= 7 && r.score <= 8).length
  const detractors = npsRows.filter((r) => r.score <= 6).length
  const score = responses
    ? Math.round(((promoters - detractors) / responses) * 100)
    : 0
  const verbatims = npsRows
    .filter((r) => r.comment)
    .slice(0, 12)
    .map((r) => ({ score: r.score, comment: r.comment ?? '' }))

  return {
    ticketsSeries,
    frtSeries,
    csatSeries,
    backlogByAge,
    byPriority,
    nps: { score, responses, promoters, passives, detractors, verbatims },
  }
}
