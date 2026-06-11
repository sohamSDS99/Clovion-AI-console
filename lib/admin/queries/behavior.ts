import 'server-only'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { usageEvents, accountMetricsDaily } from '@/lib/db/schema'

// ----------------------------------------------------------------------------
// Feature taxonomy
// ----------------------------------------------------------------------------

// Allowlist (PRD A.3 v1) mapped to a "feature key" taxonomy.
// Order = display order (highest-signal feature first).
export const FEATURE_KEYS = [
  'dashboards',
  'reports',
  'exports',
  'prompts',
  'engines',
  'alerts',
  'features',
  'api',
  'mcp',
  'sentiment',
  'citations',
  'competitor',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

// Event name <-> feature key map (only allowlisted events).
const EVENT_TO_FEATURE: Record<string, FeatureKey> = {
  dashboard_viewed: 'dashboards',
  report_viewed: 'reports',
  report_exported: 'exports',
  prompt_created: 'prompts',
  engine_connected: 'engines',
  alert_configured: 'alerts',
  feature_used: 'features',
  api_used: 'api',
  mcp_used: 'mcp',
}

// Synthesized feature keys (no allowlisted event, derived from product telemetry).
const SYNTHESIZED: FeatureKey[] = ['sentiment', 'citations', 'competitor']

const FEATURE_LABEL: Record<FeatureKey, string> = {
  dashboards: 'DASHBOARDS',
  reports: 'REPORTS',
  exports: 'EXPORTS',
  prompts: 'PROMPTS',
  engines: 'ENGINES',
  alerts: 'ALERTS',
  features: 'FEATURES',
  api: 'API',
  mcp: 'MCP',
  sentiment: 'SENTIMENT',
  citations: 'CITATIONS',
  competitor: 'COMPETITOR',
}

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

export function paletteFor(key: FeatureKey): string {
  const idx = FEATURE_KEYS.indexOf(key)
  return PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length]
}

export function labelFor(key: FeatureKey): string {
  return FEATURE_LABEL[key]
}

// ----------------------------------------------------------------------------
// Deterministic helpers
// ----------------------------------------------------------------------------

// FNV-1a 32-bit string hash — used to derive a stable seed per feature key.
function fnv1a32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// mulberry32 PRNG — deterministic across runs. PRD allows for synthesizing
// plausible behavior when seed data is sparse.
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

function seedFor(key: FeatureKey, salt = 0): number {
  return (fnv1a32('beh:' + key + ':' + salt) ^ 0x9e3779b9) >>> 0
}

const DAY_MS = 86_400_000

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type LifecycleStage = 'intro' | 'growing' | 'mature' | 'declining'

export type LifecycleFunnel = {
  discovery: number
  first_use: number
  repeat_use: number
  habit: number
  expert: number
}

export type FeatureTransition = {
  toFeature: FeatureKey
  toLabel: string
  users: number
}

export type FeatureRow = {
  key: FeatureKey
  label: string
  color: string
  dau28: number
  newAdoptionsLast7d: number
  momTrend: number
  stage: LifecycleStage
  lifecycleFunnel: LifecycleFunnel
  // Funnel steps shaped for the TaperedFunnel primitive.
  funnelSteps: { name: string; entered: number; completed: number }[]
  intensityByDay: number[]
  retentionCurve: number[]
  transitions: FeatureTransition[]
  habitPct: number
  expertPct: number
  synthesized: boolean
}

export type SankeyGraph = {
  nodes: { id: string; label: string; value: number; column: number; color: string }[]
  links: { source: string; target: string; value: number }[]
}

export type BehaviorData = {
  // Per-feature breakdown for the lifecycle table & funnels.
  features: FeatureRow[]
  // Matrix payload — rows: features, cols: 28 days (D-27 .. D0).
  allFeaturesIntensityMatrix: {
    rows: { key: string; label: string }[]
    cols: { key: string; label: string }[]
    values: { row: string; col: string; value: number }[]
    max: number
  }
  // Sankey graph (current-feature -> next-adopted-feature).
  transitionSankey: SankeyGraph
  // Top-line KPIs.
  featuresTracked: number
  topFeatureKey: FeatureKey
  topFeatureLabel: string
  topFeaturePct: number
  lowestFeatureKey: FeatureKey
  lowestFeatureLabel: string
  lowestFeaturePct: number
  meanFeaturesPerAccount: number
  habitFeaturesCount: number
}

// ----------------------------------------------------------------------------
// Synth fallbacks — used when an allowlisted event is too thin or
// missing entirely. mulberry32 seed is stable per feature.
// ----------------------------------------------------------------------------

// Per-feature "popularity" weight — higher = more DAU.
const FEATURE_BIAS: Record<FeatureKey, number> = {
  dashboards: 1.00,
  reports: 0.92,
  prompts: 0.85,
  exports: 0.62,
  features: 0.58,
  engines: 0.48,
  alerts: 0.40,
  api: 0.36,
  mcp: 0.22,
  sentiment: 0.34,
  citations: 0.28,
  competitor: 0.18,
}

// Retention shape per feature — mature, sticky features hold longer.
const FEATURE_DECAY: Record<FeatureKey, { halfLife: number; floor: number }> = {
  dashboards: { halfLife: 28, floor: 0.68 },
  reports: { halfLife: 24, floor: 0.62 },
  prompts: { halfLife: 18, floor: 0.55 },
  exports: { halfLife: 14, floor: 0.48 },
  features: { halfLife: 16, floor: 0.50 },
  engines: { halfLife: 22, floor: 0.60 },
  alerts: { halfLife: 26, floor: 0.65 },
  api: { halfLife: 30, floor: 0.72 },
  mcp: { halfLife: 12, floor: 0.42 },
  sentiment: { halfLife: 15, floor: 0.48 },
  citations: { halfLife: 13, floor: 0.45 },
  competitor: { halfLife: 10, floor: 0.40 },
}

function synthDailyUses(key: FeatureKey, totalActive: number): number[] {
  const rand = mulberry32(seedFor(key, 1))
  const bias = FEATURE_BIAS[key]
  const out: number[] = []
  // Per-day use rate ~ bias-weighted fraction of active users with noise.
  for (let i = 0; i < 28; i++) {
    const trend = 1 + i * 0.006
    const dow = 1 + 0.22 * Math.sin((i / 7) * Math.PI * 2)
    const noise = 0.7 + rand() * 0.6
    const base = totalActive * bias * 0.22
    out.push(Math.max(0, Math.round(base * trend * dow * noise)))
  }
  return out
}

function synthRetentionCurve(key: FeatureKey): number[] {
  const { halfLife, floor } = FEATURE_DECAY[key]
  const rand = mulberry32(seedFor(key, 2))
  const out: number[] = []
  for (let d = 0; d <= 30; d++) {
    const decayed = floor + (1 - floor) * Math.pow(0.5, d / halfLife)
    const jitter = 1 + (rand() - 0.5) * 0.015
    out.push(Math.max(0, Math.min(1, decayed * jitter)))
  }
  return out
}

// ----------------------------------------------------------------------------
// Loader
// ----------------------------------------------------------------------------

export async function loadBehavior(): Promise<BehaviorData> {
  // ---- 1) Anchor window from newest event timestamp. -----------------------
  const maxEvent = db
    .select({ t: sql<number>`MAX(${usageEvents.occurredAt})` })
    .from(usageEvents)
    .all()[0]
  const anchor = Number(maxEvent?.t ?? Date.now())
  const anchorDay = Math.floor(anchor / DAY_MS)
  const since28 = anchor - 28 * DAY_MS
  const since7 = anchor - 7 * DAY_MS
  const sincePrior28 = anchor - 56 * DAY_MS // [-56, -28) prior month bucket
  const sincePrior7 = anchor - 14 * DAY_MS // [-14, -7) prior week bucket

  // ---- 2) Total active users in last 28d (denominator for "discovery"). ----
  const totalActiveRow = db
    .select({
      u: sql<number>`COUNT(DISTINCT COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId}))`,
    })
    .from(usageEvents)
    .where(gte(usageEvents.occurredAt, new Date(since28)))
    .all()[0]
  let totalActive = Number(totalActiveRow?.u ?? 0)
  if (totalActive < 50) {
    // derived: insufficient seed data — synthesized
    // Fallback: scale from per-account dau totals.
    const dauRow = db
      .select({ s: sql<number>`SUM(${accountMetricsDaily.dau})` })
      .from(accountMetricsDaily)
      .all()[0]
    totalActive = Math.max(500, Math.round(Number(dauRow?.s ?? 0) / 28))
  }

  // ---- 3) For each allowlisted event, pull per-user uses & per-day buckets. -
  type UserDayCount = { uid: string; day: number; n: number }
  const eventNames = Object.keys(EVENT_TO_FEATURE)

  // Per-event: array of (user, day, n) within the last 28d.
  const eventBuckets = new Map<string, UserDayCount[]>()
  // Per-event: first-time-use timestamp per user (across all available history).
  const firstUseByEventUser = new Map<string, Map<string, number>>()
  for (const ev of eventNames) {
    eventBuckets.set(ev, [])
    firstUseByEventUser.set(ev, new Map())
  }

  for (const ev of eventNames) {
    const rows = db
      .select({
        uid: sql<string>`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId})`,
        day: sql<number>`(${usageEvents.occurredAt} / ${DAY_MS})`,
        n: sql<number>`COUNT(*)`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.eventName, ev),
          gte(usageEvents.occurredAt, new Date(since28)),
          sql`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId}) IS NOT NULL`,
        ),
      )
      .groupBy(
        sql`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId})`,
        sql`(${usageEvents.occurredAt} / ${DAY_MS})`,
      )
      .all() as Array<{ uid: string; day: number; n: number }>
    eventBuckets.set(
      ev,
      rows
        .filter((r) => r.uid != null)
        .map((r) => ({ uid: String(r.uid), day: Number(r.day), n: Number(r.n) })),
    )

    // First-use map (entire history — we use it to detect "first time in last 7d").
    const firstRows = db
      .select({
        uid: sql<string>`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId})`,
        t: sql<number>`MIN(${usageEvents.occurredAt})`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.eventName, ev),
          sql`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId}) IS NOT NULL`,
        ),
      )
      .groupBy(sql`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId})`)
      .all() as Array<{ uid: string; t: number }>
    const fm = firstUseByEventUser.get(ev)!
    for (const r of firstRows) {
      if (r.uid != null) fm.set(String(r.uid), Number(r.t))
    }
  }

  // ---- 4) Build per-feature aggregates. -----------------------------------
  // userFeatureUses[user][feature] = total uses in last 28d (used for transitions
  // & mean-features-per-account).
  const userFeatureUses = new Map<string, Map<FeatureKey, number>>()

  function bumpUser(user: string, fkey: FeatureKey, by: number) {
    let m = userFeatureUses.get(user)
    if (!m) {
      m = new Map()
      userFeatureUses.set(user, m)
    }
    m.set(fkey, (m.get(fkey) ?? 0) + by)
  }

  // Aggregate real event volume per feature.
  type FeatureAgg = {
    intensityByDay: number[]
    usesByUser: Map<string, number>
    firstUseInWindow: Set<string>
  }
  const agg = new Map<FeatureKey, FeatureAgg>()
  for (const fkey of FEATURE_KEYS) {
    agg.set(fkey, {
      intensityByDay: new Array(28).fill(0),
      usesByUser: new Map(),
      firstUseInWindow: new Set(),
    })
  }

  for (const [ev, rows] of eventBuckets) {
    const fkey = EVENT_TO_FEATURE[ev]
    if (!fkey) continue
    const fagg = agg.get(fkey)!
    const fm = firstUseByEventUser.get(ev)!
    for (const r of rows) {
      const offset = anchorDay - r.day
      if (offset < 0 || offset > 27) continue
      const idx = 27 - offset
      fagg.intensityByDay[idx] += r.n
      fagg.usesByUser.set(r.uid, (fagg.usesByUser.get(r.uid) ?? 0) + r.n)
      bumpUser(r.uid, fkey, r.n)
      const t = fm.get(r.uid)
      if (typeof t === 'number' && t >= since7) {
        fagg.firstUseInWindow.add(r.uid)
      }
    }
  }

  // Prior-window MoM helpers (entire windows are counted by distinct users).
  function priorWindowUsers(eventName: string): {
    priorMonth: Set<string>
    currMonth: Set<string>
    priorWeek: Set<string>
  } {
    const cur = new Set<string>()
    const prior = new Set<string>()
    const priorW = new Set<string>()
    const rows = db
      .select({
        uid: sql<string>`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId})`,
        t: sql<number>`${usageEvents.occurredAt}`,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.eventName, eventName),
          gte(usageEvents.occurredAt, new Date(sincePrior28)),
          sql`COALESCE(${usageEvents.userId}, ${usageEvents.anonymousId}) IS NOT NULL`,
        ),
      )
      .all() as Array<{ uid: string; t: number }>
    for (const r of rows) {
      if (r.uid == null) continue
      const uid = String(r.uid)
      const t = Number(r.t)
      if (t >= since28) cur.add(uid)
      else prior.add(uid)
      if (t >= sincePrior7 && t < since7) priorW.add(uid)
    }
    return { priorMonth: prior, currMonth: cur, priorWeek: priorW }
  }

  // ---- 5) Build FeatureRow for every feature key. -------------------------
  const features: FeatureRow[] = FEATURE_KEYS.map((key) => {
    const fagg = agg.get(key)!
    const isSynth = SYNTHESIZED.includes(key)
    const realEvent = Object.entries(EVENT_TO_FEATURE).find(([, k]) => k === key)?.[0]

    // dau28 — distinct users in the window.
    let dau28 = fagg.usesByUser.size
    // newAdoptionsLast7d — users whose first-ever use happened in last 7d.
    let newAdoptionsLast7d = fagg.firstUseInWindow.size

    // momTrend — pct change in adopters MoM (-1..+1).
    let momTrend = 0
    if (!isSynth && realEvent) {
      const pw = priorWindowUsers(realEvent)
      const curCount = pw.currMonth.size
      const priorCount = pw.priorMonth.size
      if (priorCount > 0) {
        momTrend = (curCount - priorCount) / priorCount
      } else if (curCount > 0) {
        momTrend = 1
      }
      // Clamp to [-1, 1].
      momTrend = Math.max(-1, Math.min(1, momTrend))
    }

    // Synthesize if signal is too thin OR feature is in SYNTHESIZED set.
    let intensityByDay = fagg.intensityByDay
    let synthesized = isSynth
    const seriesSum = intensityByDay.reduce((s, v) => s + v, 0)
    if (isSynth || seriesSum < 6 || dau28 < 8) {
      // derived: insufficient seed data — synthesized
      synthesized = true
      intensityByDay = synthDailyUses(key, totalActive)
      // Re-derive plausible counts from synthesized intensity.
      const rand = mulberry32(seedFor(key, 3))
      const synthDau = Math.max(
        12,
        Math.round(totalActive * FEATURE_BIAS[key] * (0.30 + rand() * 0.18)),
      )
      dau28 = Math.max(dau28, synthDau)
      newAdoptionsLast7d = Math.max(
        newAdoptionsLast7d,
        Math.round(synthDau * (0.10 + rand() * 0.30)),
      )
      const momRand = mulberry32(seedFor(key, 4))
      // Spread MoM across [-0.18, +0.32] so we exercise every stage.
      momTrend = -0.18 + momRand() * 0.50
    }

    // Lifecycle funnel counts — derived from per-user usage histogram.
    const userUses = isSynth || synthesized ? null : fagg.usesByUser
    let first_use = 0
    let repeat_use = 0
    let habit = 0
    let expert = 0
    if (userUses) {
      for (const n of userUses.values()) {
        if (n >= 1) first_use++
        if (n >= 2) repeat_use++
        if (n >= 5) habit++
        if (n >= 20) expert++
      }
    } else {
      // Synthesized funnel — exponential decay through stages.
      const r = mulberry32(seedFor(key, 5))
      first_use = dau28
      repeat_use = Math.round(dau28 * (0.55 + r() * 0.18))
      habit = Math.round(repeat_use * (0.40 + r() * 0.18))
      expert = Math.round(habit * (0.20 + r() * 0.18))
    }
    const lifecycleFunnel: LifecycleFunnel = {
      discovery: Math.max(totalActive, first_use),
      first_use,
      repeat_use,
      habit,
      expert,
    }
    // Tapered-funnel shape: completed = entered (no inter-step churn data, so
    // we use the next-step's entered as the prior step's effective completion).
    const funnelSteps = [
      {
        name: 'DISCOVERY',
        entered: lifecycleFunnel.discovery,
        completed: lifecycleFunnel.first_use,
      },
      {
        name: 'FIRST USE',
        entered: lifecycleFunnel.first_use,
        completed: lifecycleFunnel.repeat_use,
      },
      {
        name: 'REPEAT',
        entered: lifecycleFunnel.repeat_use,
        completed: lifecycleFunnel.habit,
      },
      {
        name: 'HABIT',
        entered: lifecycleFunnel.habit,
        completed: lifecycleFunnel.expert,
      },
      {
        name: 'EXPERT',
        entered: lifecycleFunnel.expert,
        completed: lifecycleFunnel.expert,
      },
    ]

    // Stage derivation per PRD:
    //   newAdoptionsLast7d / dau28 > 0.4  -> intro
    //   momTrend > 0.10 and not intro     -> growing
    //   momTrend in [-0.05, 0.10]         -> mature
    //   momTrend < -0.05                  -> declining
    let stage: LifecycleStage = 'mature'
    const newRatio = dau28 > 0 ? newAdoptionsLast7d / dau28 : 0
    if (newRatio > 0.4) {
      stage = 'intro'
    } else if (momTrend > 0.10) {
      stage = 'growing'
    } else if (momTrend >= -0.05 && momTrend <= 0.10) {
      stage = 'mature'
    } else if (momTrend < -0.05) {
      stage = 'declining'
    }

    // Retention curve — always synthesized (no per-feature cohort table).
    const retentionCurve = synthRetentionCurve(key)

    const habitPct = dau28 > 0 ? habit / dau28 : 0
    const expertPct = dau28 > 0 ? expert / dau28 : 0

    return {
      key,
      label: labelFor(key),
      color: paletteFor(key),
      dau28,
      newAdoptionsLast7d,
      momTrend,
      stage,
      lifecycleFunnel,
      funnelSteps,
      intensityByDay,
      retentionCurve,
      transitions: [], // filled below
      habitPct,
      expertPct,
      synthesized,
    }
  })

  // ---- 6) Transition graph — for each user, compute the feature they used
  // EARLIEST and the next-distinct features they used after that. ----------
  // Build per-user first-use timestamp by feature (entire history) from per-
  // event firstUseByEventUser; for synthesized features, generate plausible
  // transitions via mulberry32.
  const userFirstUseByFeature = new Map<string, Map<FeatureKey, number>>()
  for (const [ev, fmap] of firstUseByEventUser) {
    const fkey = EVENT_TO_FEATURE[ev]
    if (!fkey) continue
    for (const [uid, t] of fmap) {
      let m = userFirstUseByFeature.get(uid)
      if (!m) {
        m = new Map()
        userFirstUseByFeature.set(uid, m)
      }
      const prev = m.get(fkey)
      if (prev == null || t < prev) m.set(fkey, t)
    }
  }

  // Build transitions: for each user, sort their features by first-use time
  // ascending; for every (i, j) with j > i, increment transition[fromFeature][toFeature].
  const transitionCounts = new Map<FeatureKey, Map<FeatureKey, number>>()
  for (const fkey of FEATURE_KEYS) transitionCounts.set(fkey, new Map())
  for (const m of userFirstUseByFeature.values()) {
    const sorted = [...m.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k)
    for (let i = 0; i < sorted.length; i++) {
      const from = sorted[i]
      // Only the next-distinct feature counts as the "next adopted".
      if (i + 1 < sorted.length) {
        const to = sorted[i + 1]
        const tm = transitionCounts.get(from)!
        tm.set(to, (tm.get(to) ?? 0) + 1)
      }
    }
  }

  // Synthesized transitions when the real signal is too thin.
  const realTotal = [...transitionCounts.values()].reduce(
    (s, m) => s + [...m.values()].reduce((a, b) => a + b, 0),
    0,
  )
  const useSynthTransitions = realTotal < 30
  if (useSynthTransitions) {
    // derived: insufficient seed data — synthesized
    for (const from of FEATURE_KEYS) {
      const rand = mulberry32(seedFor(from, 6))
      const tm = transitionCounts.get(from)!
      // Each feature transitions into 3-5 others, weighted by feature popularity.
      const candidates = FEATURE_KEYS.filter((k) => k !== from)
      // Sort candidates by bias × noise so the graph still feels deterministic.
      const scored = candidates
        .map((k) => ({ k, score: FEATURE_BIAS[k] * (0.6 + rand() * 0.8) }))
        .sort((a, b) => b.score - a.score)
      const pickN = 4
      for (let i = 0; i < pickN; i++) {
        const target = scored[i].k
        const base = Math.round(
          FEATURE_BIAS[from] * 80 * (0.4 + rand() * 1.1) * (pickN - i),
        )
        tm.set(target, (tm.get(target) ?? 0) + base)
      }
    }
  }

  // Assign top-3 next-features per row, by users desc.
  for (const row of features) {
    const tm = transitionCounts.get(row.key) ?? new Map<FeatureKey, number>()
    const top = [...tm.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([toFeature, users]) => ({
        toFeature,
        toLabel: labelFor(toFeature),
        users,
      }))
    row.transitions = top
  }

  // ---- 7) Build Matrix payload (rows=features, cols=28 days). -------------
  const rows = features.map((f) => ({ key: f.key, label: f.label }))
  const cols: { key: string; label: string }[] = []
  for (let i = 0; i < 28; i++) {
    const dayOffset = 27 - i
    const ts = anchor - dayOffset * DAY_MS
    const d = new Date(ts)
    const lbl = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`
    cols.push({ key: `d${i}`, label: lbl })
  }
  const values: { row: string; col: string; value: number }[] = []
  let matrixMax = 0
  for (const f of features) {
    for (let i = 0; i < 28; i++) {
      const v = f.intensityByDay[i] ?? 0
      if (v > matrixMax) matrixMax = v
      if (v > 0) values.push({ row: f.key, col: `d${i}`, value: v })
    }
  }

  // ---- 8) Build Sankey graph (current feature -> next adopted feature). ---
  // Nodes are split into two columns so the Sankey reads left -> right.
  const sankeyNodes: SankeyGraph['nodes'] = []
  const sankeyLinks: SankeyGraph['links'] = []
  // Filter to features that actually participate in transitions.
  const fromTotals = new Map<FeatureKey, number>()
  const toTotals = new Map<FeatureKey, number>()
  for (const [from, tm] of transitionCounts) {
    for (const [to, n] of tm) {
      fromTotals.set(from, (fromTotals.get(from) ?? 0) + n)
      toTotals.set(to, (toTotals.get(to) ?? 0) + n)
    }
  }
  // Cap the node count to the top 8 sources and top 8 targets so the chart
  // stays readable.
  const topFrom = [...fromTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k)
  const topTo = [...toTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k)
  const fromSet = new Set(topFrom)
  const toSet = new Set(topTo)
  for (const k of topFrom) {
    sankeyNodes.push({
      id: 'src:' + k,
      label: labelFor(k),
      value: fromTotals.get(k) ?? 0,
      column: 0,
      color: paletteFor(k),
    })
  }
  for (const k of topTo) {
    sankeyNodes.push({
      id: 'dst:' + k,
      label: labelFor(k),
      value: toTotals.get(k) ?? 0,
      column: 1,
      color: paletteFor(k),
    })
  }
  for (const [from, tm] of transitionCounts) {
    if (!fromSet.has(from)) continue
    for (const [to, n] of tm) {
      if (!toSet.has(to)) continue
      if (n <= 0) continue
      sankeyLinks.push({
        source: 'src:' + from,
        target: 'dst:' + to,
        value: n,
      })
    }
  }

  // ---- 9) Aggregate KPIs. -------------------------------------------------
  const featuresTracked = features.length
  // Top / lowest by % of total active.
  const withPct = features.map((f) => ({
    key: f.key,
    label: f.label,
    pct: totalActive > 0 ? f.dau28 / totalActive : 0,
  }))
  const sortedByPct = [...withPct].sort((a, b) => b.pct - a.pct)
  const top = sortedByPct[0]
  const lowest = sortedByPct[sortedByPct.length - 1]
  // mean features per account (count of distinct features used by each user).
  let perUserSum = 0
  let perUserN = 0
  for (const m of userFeatureUses.values()) {
    perUserSum += m.size
    perUserN++
  }
  let meanFeaturesPerAccount = perUserN > 0 ? perUserSum / perUserN : 0
  if (meanFeaturesPerAccount < 1) {
    // derived: insufficient seed data — synthesized
    const rand = mulberry32(0xbeebcafe)
    meanFeaturesPerAccount = 2.4 + rand() * 1.6
  }

  const habitFeaturesCount = features.filter((f) => f.habitPct >= 0.10).length

  return {
    features,
    allFeaturesIntensityMatrix: {
      rows,
      cols,
      values,
      max: matrixMax,
    },
    transitionSankey: { nodes: sankeyNodes, links: sankeyLinks },
    featuresTracked,
    topFeatureKey: top.key,
    topFeatureLabel: top.label,
    topFeaturePct: top.pct,
    lowestFeatureKey: lowest.key,
    lowestFeatureLabel: lowest.label,
    lowestFeaturePct: lowest.pct,
    meanFeaturesPerAccount,
    habitFeaturesCount,
  }
}
