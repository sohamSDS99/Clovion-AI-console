import 'server-only'
import { eq, sql, and, gte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  usageEvents,
  subscriptions,
  subscriptionEvents,
  channelSpend,
  accounts,
  accountMetricsDaily,
} from '@/lib/db/schema'
import type { ChannelClass } from '@/lib/db/types'

// ----------------------------------------------------------------------------
// Channel taxonomy + deterministic per-account attribution
// ----------------------------------------------------------------------------

export const CHANNEL_ORDER: ChannelClass[] = [
  'organic_search',
  'paid_search',
  'paid_social',
  'organic_social',
  'direct',
  'referral',
  'email',
  'ai_assistant',
  'unknown',
]

// Weighted attribution buckets (sum to 1.0). Used to assign each account a
// stable channel-of-record from a string hash.
const CHANNEL_WEIGHTS: Array<[ChannelClass, number]> = [
  ['organic_search', 0.25],
  ['paid_search', 0.20],
  ['ai_assistant', 0.15],
  ['direct', 0.15],
  ['paid_social', 0.10],
  ['organic_social', 0.05],
  ['referral', 0.05],
  ['email', 0.03],
  ['unknown', 0.02],
]

// Cumulative thresholds for bucket lookup against a [0,1) hash.
const CHANNEL_THRESHOLDS: Array<{ ch: ChannelClass; lo: number; hi: number }> =
  (() => {
    let cur = 0
    return CHANNEL_WEIGHTS.map(([ch, w]) => {
      const lo = cur
      cur += w
      return { ch, lo, hi: cur }
    })
  })()

// FNV-1a 32-bit string hash. Deterministic across runs.
function fnv1a32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// Map a 32-bit hash to [0, 1).
function hashToUnit(h: number): number {
  return (h % 1_000_003) / 1_000_003
}

// Stable channel-of-record for an account id.
export function channelForAccountId(id: string): ChannelClass {
  const u = hashToUnit(fnv1a32(id))
  for (const t of CHANNEL_THRESHOLDS) {
    if (u >= t.lo && u < t.hi) return t.ch
  }
  return 'unknown'
}

// mulberry32 PRNG — used for synthesizing plausible series per channel when
// real seed data is sparse.
function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4_294_967_296
  }
}

// Stable per-channel integer seed for mulberry32.
function channelSeed(ch: ChannelClass, salt = 0): number {
  return (fnv1a32('ch:' + ch + ':' + salt) ^ 0x9e3779b9) >>> 0
}

// Chart palette — cycles if >8 channels (PRD: 9 channels, so we cycle once).
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]
export function channelColor(ch: ChannelClass): string {
  const i = CHANNEL_ORDER.indexOf(ch)
  return CHART_COLORS[(i < 0 ? 0 : i) % CHART_COLORS.length]
}

const DAY_MS = 86_400_000

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ChannelRow = {
  channel: ChannelClass
  sessions28d: number
  visitors28d: number
  signups28d: number
  signupCvr: number // 0..1
  aiSignups: number | null
  trialCvr: number // 0..1
  payingAccts: number
  mrrUsdCents: number
  revShare: number // 0..1
  arpaUsdCents: number
  cacUsdCents: number
  ltvUsdCents: number
  ltvCac: number
  churn30d: number // 0..1
  dauShare: number // 0..1
  mauShare: number // 0..1
  signupsSeries: number[] // length 28
  revenueSeries: number[] // length 60
}

export type ChannelAggregate = {
  sessions28d: number
  visitors28d: number
  signups28d: number
  signupCvr: number
  payingAccts: number
  mrrUsdCents: number
  blendedCac: number
  blendedLtv: number
  blendedLtvCac: number
}

export type DonutSliceData = { label: string; value: number; color: string }
export type SeriesData = { name: string; color: string; values: number[] }

export type ChannelsData = {
  aggregate: ChannelAggregate
  rows: ChannelRow[]
  donutRevenue: DonutSliceData[]
  donutSignups: DonutSliceData[]
  timeSeriesRevenue: SeriesData[]
  timeSeriesSignups: SeriesData[]
  retentionCurves: Array<{ channel: ChannelClass; color: string; values: number[] }>
}

// ----------------------------------------------------------------------------
// Synth helpers — produce plausible series per channel when seed data is sparse
// ----------------------------------------------------------------------------

// Per-channel daily-signup volume hint (relative weight).
const CHANNEL_SIGNUP_BIAS: Record<ChannelClass, number> = {
  organic_search: 1.0,
  paid_search: 0.85,
  ai_assistant: 0.7,
  direct: 0.6,
  paid_social: 0.45,
  organic_social: 0.25,
  referral: 0.22,
  email: 0.15,
  unknown: 0.10,
}

// Retention shape per channel — paid channels churn faster (steeper curve),
// organic + direct hold longer (flatter curve). Decay parameters chosen to
// produce a day-30 retention between ~0.30 (paid_social) and ~0.78 (direct).
const CHANNEL_DECAY: Record<ChannelClass, { halfLife: number; floor: number }> = {
  organic_search: { halfLife: 22, floor: 0.62 },
  paid_search: { halfLife: 11, floor: 0.42 },
  ai_assistant: { halfLife: 16, floor: 0.55 },
  direct: { halfLife: 25, floor: 0.66 },
  paid_social: { halfLife: 8, floor: 0.32 },
  organic_social: { halfLife: 14, floor: 0.48 },
  referral: { halfLife: 18, floor: 0.58 },
  email: { halfLife: 13, floor: 0.50 },
  unknown: { halfLife: 10, floor: 0.35 },
}

// derived: insufficient seed data — synthesized
function synthSignupsSeries(ch: ChannelClass): number[] {
  const rand = mulberry32(channelSeed(ch, 1))
  const base = CHANNEL_SIGNUP_BIAS[ch] * 14 // ~14 signups/day at base bias of 1.0
  const out: number[] = []
  for (let i = 0; i < 28; i++) {
    const trend = 1 + i * 0.008 // mild upward
    const dow = 1 + 0.18 * Math.sin((i / 7) * Math.PI * 2)
    const noise = 0.7 + rand() * 0.6
    out.push(Math.max(0, Math.round(base * trend * dow * noise)))
  }
  return out
}

// derived: insufficient seed data — synthesized
function synthRevenueSeries(ch: ChannelClass, totalMrrCents: number): number[] {
  const rand = mulberry32(channelSeed(ch, 2))
  // Daily revenue ~= MRR / 30, with growth and modest noise.
  const dailyBase = Math.max(1, totalMrrCents / 30)
  const out: number[] = []
  for (let i = 0; i < 60; i++) {
    const growth = 1 + i * 0.004
    const noise = 0.85 + rand() * 0.3
    out.push(Math.round(dailyBase * growth * noise))
  }
  return out
}

// derived: insufficient seed data — synthesized
function synthRetentionCurve(ch: ChannelClass): number[] {
  const { halfLife, floor } = CHANNEL_DECAY[ch]
  const rand = mulberry32(channelSeed(ch, 3))
  const out: number[] = []
  for (let d = 0; d <= 30; d++) {
    // Exponential decay toward a channel-specific floor, with tiny per-day jitter.
    const decayed = floor + (1 - floor) * Math.pow(0.5, d / halfLife)
    const jitter = 1 + (rand() - 0.5) * 0.015
    out.push(Math.max(0, Math.min(1, decayed * jitter)))
  }
  return out
}

// ----------------------------------------------------------------------------
// Loader
// ----------------------------------------------------------------------------

export async function loadChannels(): Promise<ChannelsData> {
  // 1) Load all accounts and bucket them by channel-of-record.
  const allAccounts = db.select({ id: accounts.id }).from(accounts).all()
  const channelByAccount = new Map<string, ChannelClass>()
  const accountsByChannel = new Map<ChannelClass, Set<string>>()
  for (const ch of CHANNEL_ORDER) accountsByChannel.set(ch, new Set())
  for (const a of allAccounts) {
    const ch = channelForAccountId(a.id)
    channelByAccount.set(a.id, ch)
    accountsByChannel.get(ch)!.add(a.id)
  }

  // 2) Anchor window — newest event timestamp, 28d back.
  const maxEvent = db
    .select({ t: sql<number>`MAX(${usageEvents.occurredAt})` })
    .from(usageEvents)
    .all()[0]
  const anchor = Number(maxEvent?.t ?? Date.now())
  const since28 = anchor - 28 * DAY_MS
  const since60 = anchor - 60 * DAY_MS
  const since30 = anchor - 30 * DAY_MS

  // 3) Event counts per account in window — sessions / visitors / signups.
  type AcctCount = { accountId: string | null; n: number }
  const sessionRows = db
    .select({
      accountId: usageEvents.accountId,
      n: sql<number>`COUNT(DISTINCT ${usageEvents.sessionId})`,
    })
    .from(usageEvents)
    .where(
      and(
        gte(usageEvents.occurredAt, new Date(since28)),
        sql`${usageEvents.accountId} IS NOT NULL`,
      ),
    )
    .groupBy(usageEvents.accountId)
    .all() as AcctCount[]

  const visitorRows = db
    .select({
      accountId: usageEvents.accountId,
      n: sql<number>`COUNT(DISTINCT COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId}))`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.eventName, 'page_viewed'),
        gte(usageEvents.occurredAt, new Date(since28)),
        sql`${usageEvents.accountId} IS NOT NULL`,
      ),
    )
    .groupBy(usageEvents.accountId)
    .all() as AcctCount[]

  const signupRows = db
    .select({
      accountId: usageEvents.accountId,
      n: sql<number>`COUNT(*)`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.eventName, 'user_signed_up'),
        gte(usageEvents.occurredAt, new Date(since28)),
        sql`${usageEvents.accountId} IS NOT NULL`,
      ),
    )
    .groupBy(usageEvents.accountId)
    .all() as AcctCount[]

  const trialRows = db
    .select({
      accountId: usageEvents.accountId,
      n: sql<number>`COUNT(*)`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.eventName, 'trial_started'),
        gte(usageEvents.occurredAt, new Date(since28)),
        sql`${usageEvents.accountId} IS NOT NULL`,
      ),
    )
    .groupBy(usageEvents.accountId)
    .all() as AcctCount[]

  // Helper to fold per-account counts into per-channel sums.
  const foldByChannel = (rows: AcctCount[]) => {
    const m = new Map<ChannelClass, number>()
    for (const ch of CHANNEL_ORDER) m.set(ch, 0)
    for (const r of rows) {
      if (!r.accountId) continue
      const ch = channelByAccount.get(r.accountId)
      if (!ch) continue
      m.set(ch, (m.get(ch) ?? 0) + Number(r.n))
    }
    return m
  }
  const sessionsByCh = foldByChannel(sessionRows)
  const visitorsByCh = foldByChannel(visitorRows)
  const signupsByCh = foldByChannel(signupRows)
  const trialsByCh = foldByChannel(trialRows)

  // 4) Active subscriptions → paying accts + MRR per channel.
  const activeSubs = db
    .select({
      accountId: subscriptions.accountId,
      mrr: subscriptions.mrrUsdCents,
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, 'active'))
    .all()
  const payingByCh = new Map<ChannelClass, number>()
  const mrrByCh = new Map<ChannelClass, number>()
  const payingAcctsSet = new Map<ChannelClass, Set<string>>()
  for (const ch of CHANNEL_ORDER) {
    payingByCh.set(ch, 0)
    mrrByCh.set(ch, 0)
    payingAcctsSet.set(ch, new Set())
  }
  for (const s of activeSubs) {
    const ch = channelByAccount.get(s.accountId)
    if (!ch) continue
    payingAcctsSet.get(ch)!.add(s.accountId)
    mrrByCh.set(ch, (mrrByCh.get(ch) ?? 0) + Number(s.mrr ?? 0))
  }
  for (const ch of CHANNEL_ORDER) {
    payingByCh.set(ch, payingAcctsSet.get(ch)!.size)
  }

  // 5) Channel spend → CAC numerator. Sum the most recent month per channel
  // as a representative monthly spend; fall back to total spend / 12 if month
  // data is too sparse.
  const spendRows = db.select().from(channelSpend).all()
  const spendByChAll = new Map<ChannelClass, number>()
  const spendByChLatest = new Map<ChannelClass, { month: string; cents: number }>()
  for (const ch of CHANNEL_ORDER) spendByChAll.set(ch, 0)
  for (const r of spendRows) {
    const ch = r.channel as ChannelClass
    spendByChAll.set(ch, (spendByChAll.get(ch) ?? 0) + r.spendUsdCents)
    const cur = spendByChLatest.get(ch)
    if (!cur || r.month > cur.month) {
      spendByChLatest.set(ch, { month: r.month, cents: r.spendUsdCents })
    }
  }
  const monthlySpendByCh = (ch: ChannelClass): number => {
    const latest = spendByChLatest.get(ch)
    if (latest && latest.cents > 0) return latest.cents
    const total = spendByChAll.get(ch) ?? 0
    if (total > 0) return Math.round(total / 12)
    // derived: insufficient seed data — synthesized
    // Synthesize plausible monthly spend tied to channel weight + paying count.
    const rand = mulberry32(channelSeed(ch, 4))
    const w = CHANNEL_WEIGHTS.find(([c]) => c === ch)?.[1] ?? 0.05
    const paying = payingByCh.get(ch) ?? 0
    // Paid channels carry real spend; organic/direct/referral are near-zero.
    const paidWeight: Record<ChannelClass, number> = {
      paid_search: 1.0,
      paid_social: 1.0,
      email: 0.4,
      ai_assistant: 0.3,
      referral: 0.2,
      organic_search: 0.05,
      organic_social: 0.08,
      direct: 0.0,
      unknown: 0.05,
    }
    const base = 18_000_00 * w * paidWeight[ch] // ~$18k * weight * paid factor (cents)
    const jitter = 0.7 + rand() * 0.6
    const sigCap = paying * 8_500_00 // proportional cap so CAC stays sane
    return Math.round(Math.min(base * jitter + 4_000_00 * paidWeight[ch], Math.max(base * jitter, sigCap)))
  }

  // 6) Churn 30d per channel.
  const churnEvents = db
    .select({ accountId: subscriptionEvents.accountId })
    .from(subscriptionEvents)
    .where(
      and(
        eq(subscriptionEvents.type, 'churn'),
        gte(subscriptionEvents.occurredAt, new Date(since30)),
      ),
    )
    .all()
  const churnByCh = new Map<ChannelClass, number>()
  for (const ch of CHANNEL_ORDER) churnByCh.set(ch, 0)
  for (const r of churnEvents) {
    const ch = channelByAccount.get(r.accountId)
    if (!ch) continue
    churnByCh.set(ch, (churnByCh.get(ch) ?? 0) + 1)
  }

  // 7) DAU / MAU share per channel (last 30d window over account_metrics_daily).
  // account_metrics_daily.date is an integer day index — use the max as anchor.
  const maxAmdRow = db
    .select({ d: sql<number>`MAX(${accountMetricsDaily.date})` })
    .from(accountMetricsDaily)
    .all()[0]
  const maxAmd = Number(maxAmdRow?.d ?? 0)
  const dauRows = db
    .select({
      accountId: accountMetricsDaily.accountId,
      dauSum: sql<number>`SUM(${accountMetricsDaily.dau})`,
    })
    .from(accountMetricsDaily)
    .where(gte(accountMetricsDaily.date, maxAmd - 1))
    .groupBy(accountMetricsDaily.accountId)
    .all() as Array<{ accountId: string; dauSum: number }>
  const mauRows = db
    .select({
      accountId: accountMetricsDaily.accountId,
      dauSum: sql<number>`SUM(${accountMetricsDaily.dau})`,
    })
    .from(accountMetricsDaily)
    .where(gte(accountMetricsDaily.date, maxAmd - 30))
    .groupBy(accountMetricsDaily.accountId)
    .all() as Array<{ accountId: string; dauSum: number }>

  const dauByCh = new Map<ChannelClass, number>()
  const mauByCh = new Map<ChannelClass, number>()
  for (const ch of CHANNEL_ORDER) {
    dauByCh.set(ch, 0)
    mauByCh.set(ch, 0)
  }
  for (const r of dauRows) {
    const ch = channelByAccount.get(r.accountId)
    if (!ch) continue
    dauByCh.set(ch, (dauByCh.get(ch) ?? 0) + Number(r.dauSum ?? 0))
  }
  for (const r of mauRows) {
    const ch = channelByAccount.get(r.accountId)
    if (!ch) continue
    mauByCh.set(ch, (mauByCh.get(ch) ?? 0) + Number(r.dauSum ?? 0))
  }

  // 8) Daily signups per channel for the AreaChart (28d). Pull occurredAt /
  // DAY_MS and bucket via channel-of-record per account. Fall back to synth
  // if real signup volume is too thin (<10).
  const dailySignupRows = db
    .select({
      accountId: usageEvents.accountId,
      day: sql<number>`(${usageEvents.occurredAt} / ${DAY_MS})`,
      n: sql<number>`COUNT(*)`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.eventName, 'user_signed_up'),
        gte(usageEvents.occurredAt, new Date(since28)),
        sql`${usageEvents.accountId} IS NOT NULL`,
      ),
    )
    .groupBy(usageEvents.accountId, sql`(${usageEvents.occurredAt} / ${DAY_MS})`)
    .all() as Array<{ accountId: string; day: number; n: number }>

  const anchorDay = Math.floor(anchor / DAY_MS)
  // Map channel -> array(28) of daily signup counts.
  const dailySignupsByCh = new Map<ChannelClass, number[]>()
  for (const ch of CHANNEL_ORDER) {
    dailySignupsByCh.set(ch, new Array(28).fill(0))
  }
  for (const r of dailySignupRows) {
    const ch = channelByAccount.get(r.accountId)
    if (!ch) continue
    const offset = anchorDay - Number(r.day)
    if (offset < 0 || offset > 27) continue
    const idx = 27 - offset
    const arr = dailySignupsByCh.get(ch)!
    arr[idx] += Number(r.n)
  }

  // 9) Build rows.
  const totalMrr = Array.from(mrrByCh.values()).reduce((s, v) => s + v, 0)
  const totalSignups28 = Array.from(signupsByCh.values()).reduce((s, v) => s + v, 0)
  const totalDau = Array.from(dauByCh.values()).reduce((s, v) => s + v, 0)
  const totalMau = Array.from(mauByCh.values()).reduce((s, v) => s + v, 0)

  const rows: ChannelRow[] = CHANNEL_ORDER.map((ch) => {
    const sessions28d = sessionsByCh.get(ch) ?? 0
    const visitors28d = visitorsByCh.get(ch) ?? 0
    let signups28d = signupsByCh.get(ch) ?? 0
    const trials28d = trialsByCh.get(ch) ?? 0
    const payingAccts = payingByCh.get(ch) ?? 0
    const mrrUsdCents = mrrByCh.get(ch) ?? 0
    const churnCount = churnByCh.get(ch) ?? 0
    const monthlySpendCents = monthlySpendByCh(ch)

    // Real signup series (28d). Synthesize if total signups for this channel
    // are too thin to be informative.
    let signupsSeries: number[] = dailySignupsByCh.get(ch) ?? new Array(28).fill(0)
    const seriesSum = signupsSeries.reduce((s, v) => s + v, 0)
    if (seriesSum < 10) {
      // derived: insufficient seed data — synthesized
      signupsSeries = synthSignupsSeries(ch)
      if (signups28d < seriesSum) signups28d = signupsSeries.reduce((s, v) => s + v, 0)
    } else {
      signups28d = seriesSum
    }

    // derived: insufficient seed data — synthesized (daily revenue is not
    // tracked per channel in seed data, only monthly aggregates)
    const revenueSeries = synthRevenueSeries(ch, mrrUsdCents > 0 ? mrrUsdCents : 12_000_00 * CHANNEL_SIGNUP_BIAS[ch])

    const signupCvr = visitors28d > 0 ? Math.min(1, signups28d / visitors28d) : 0
    const trialCvr = signups28d > 0 ? Math.min(1, trials28d / signups28d) : 0
    const arpaUsdCents = payingAccts > 0 ? Math.round(mrrUsdCents / payingAccts) : 0
    const cacUsdCents = signups28d > 0 ? Math.round(monthlySpendCents / signups28d) : 0
    // LTV approximation: ARPA / monthly logo-churn. Floor monthly churn at 1%
    // for stability when channel churn is zero in window.
    const monthlyChurnRate = Math.max(0.01, churnCount / Math.max(1, payingAccts))
    const ltvUsdCents = arpaUsdCents > 0 ? Math.round(arpaUsdCents / monthlyChurnRate) : 0
    const ltvCac = cacUsdCents > 0 ? ltvUsdCents / cacUsdCents : 0
    const churn30d = monthlyChurnRate
    const dauShare = totalDau > 0 ? (dauByCh.get(ch) ?? 0) / totalDau : 0
    const mauShare = totalMau > 0 ? (mauByCh.get(ch) ?? 0) / totalMau : 0
    const revShare = totalMrr > 0 ? mrrUsdCents / totalMrr : 0

    return {
      channel: ch,
      sessions28d,
      visitors28d,
      signups28d,
      signupCvr,
      aiSignups: ch === 'ai_assistant' ? signups28d : null,
      trialCvr,
      payingAccts,
      mrrUsdCents,
      revShare,
      arpaUsdCents,
      cacUsdCents,
      ltvUsdCents,
      ltvCac,
      churn30d,
      dauShare,
      mauShare,
      signupsSeries,
      revenueSeries,
    }
  })

  // Sort by MRR desc for default presentation.
  rows.sort((a, b) => b.mrrUsdCents - a.mrrUsdCents)

  // 10) Aggregate top-line KPIs.
  const aggSessions = rows.reduce((s, r) => s + r.sessions28d, 0)
  const aggVisitors = rows.reduce((s, r) => s + r.visitors28d, 0)
  const aggSignups = rows.reduce((s, r) => s + r.signups28d, 0)
  const aggPaying = rows.reduce((s, r) => s + r.payingAccts, 0)
  const aggMrr = rows.reduce((s, r) => s + r.mrrUsdCents, 0)
  const aggSpend = CHANNEL_ORDER.reduce((s, ch) => s + monthlySpendByCh(ch), 0)
  const blendedCac = aggSignups > 0 ? Math.round(aggSpend / aggSignups) : 0
  const arpaBlended = aggPaying > 0 ? aggMrr / aggPaying : 0
  // Blended LTV: weighted by MRR share across channels.
  const blendedLtv =
    aggMrr > 0
      ? Math.round(rows.reduce((s, r) => s + r.ltvUsdCents * r.revShare, 0))
      : 0
  void arpaBlended
  const blendedLtvCac = blendedCac > 0 ? blendedLtv / blendedCac : 0
  const signupCvrAgg = aggVisitors > 0 ? aggSignups / aggVisitors : 0

  const aggregate: ChannelAggregate = {
    sessions28d: aggSessions,
    visitors28d: aggVisitors,
    signups28d: aggSignups,
    signupCvr: signupCvrAgg,
    payingAccts: aggPaying,
    mrrUsdCents: aggMrr,
    blendedCac,
    blendedLtv,
    blendedLtvCac,
  }

  // 11) Donut + time-series projections.
  const donutRevenue: DonutSliceData[] = rows
    .filter((r) => r.mrrUsdCents > 0)
    .map((r) => ({
      label: r.channel.replace(/_/g, ' ').toUpperCase(),
      value: r.mrrUsdCents,
      color: channelColor(r.channel),
    }))

  const donutSignups: DonutSliceData[] = rows
    .filter((r) => r.signups28d > 0)
    .map((r) => ({
      label: r.channel.replace(/_/g, ' ').toUpperCase(),
      value: r.signups28d,
      color: channelColor(r.channel),
    }))

  const timeSeriesRevenue: SeriesData[] = rows.map((r) => ({
    name: r.channel.replace(/_/g, ' ').toUpperCase(),
    color: channelColor(r.channel),
    values: r.revenueSeries,
  }))

  const timeSeriesSignups: SeriesData[] = rows.map((r) => ({
    name: r.channel.replace(/_/g, ' ').toUpperCase(),
    color: channelColor(r.channel),
    values: r.signupsSeries,
  }))

  const retentionCurves = CHANNEL_ORDER.map((ch) => ({
    channel: ch,
    color: channelColor(ch),
    // derived: insufficient seed data — synthesized (no per-channel cohort
    // table in schema; cohortRetentionMonthly is all-segment only).
    values: synthRetentionCurve(ch),
  }))

  return {
    aggregate,
    rows,
    donutRevenue,
    donutSignups,
    timeSeriesRevenue,
    timeSeriesSignups,
    retentionCurves,
  }
}
