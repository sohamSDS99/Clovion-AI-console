// Deterministic seed for the Clovion Console demo SQLite DB.
// All randomness comes from mulberry32(0x1337). "Now" is a fixed REFERENCE_TS.
// Idempotent: every table is DELETEd before inserts.

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import * as schema from '../lib/db/schema'
import type {
  PlanTier,
  AccountType,
  EngineKey,
  SubEventType,
  PipelineStatus,
  FailureClass,
  TicketPriority,
  TicketStatus,
  ReasonCode,
  ChannelClass,
  AlertSeverity,
  AlertStatus,
  AdminActionType,
  AdminActionStatus,
  Role,
} from '../lib/db/types'

const REFERENCE_TS = 1717977600000 // 2024-06-10T00:00:00Z
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const SEED = 0x1337

// ---------- deterministic PRNG ----------
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(SEED)
const rand = () => rng()
const randInt = (min: number, max: number) =>
  Math.floor(rand() * (max - min + 1)) + min
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
function pickWeighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0)
  let r = rand() * total
  for (const i of items) {
    r -= i.weight
    if (r <= 0) return i.value
  }
  return items[items.length - 1].value
}

// ---------- DB ----------
const url = process.env.DATABASE_URL ?? './data/console.db'
if (!existsSync(dirname(url))) mkdirSync(dirname(url), { recursive: true })
const sqlite = new Database(url)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')
const db = drizzle(sqlite, { schema })

// ---------- helpers ----------
function dayOf(ts: number) {
  return Math.floor(ts / DAY_MS)
}
function monthKey(ts: number) {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
function quarterKey(ts: number) {
  const d = new Date(ts)
  const q = Math.floor(d.getUTCMonth() / 3) + 1
  return `${d.getUTCFullYear()}-Q${q}`
}
function uid(prefix: string, n: number): string {
  return `${prefix}_${n.toString(36).padStart(6, '0')}`
}

const ENGINES: EngineKey[] = [
  'chatgpt',
  'perplexity',
  'gemini',
  'google_aio',
  'copilot',
  'claude',
]

const PLAN_MRR: Record<PlanTier, number> = {
  free: 0,
  starter: 9900,
  growth: 49900,
  enterprise: 249900,
}

const CHANNELS: ChannelClass[] = [
  'organic_search',
  'paid_search',
  'paid_social',
  'organic_social',
  'referral',
  'direct',
  'email',
  'ai_assistant',
]

// ---------- truncate ----------
function truncateAll() {
  const tables = [
    'staff_users',
    'accounts',
    'users',
    'workspaces',
    'subscriptions',
    'usage_events',
    'identity_map',
    'pipeline_runs',
    'llm_cost_ledger',
    'subscription_events',
    'stripe_invoices',
    'stripe_balance_txns',
    'support_tickets_mirror',
    'nps_responses',
    'metric_rollup_hourly',
    'metric_rollup_daily',
    'account_metrics_daily',
    'funnel_definitions',
    'funnel_results_daily',
    'cohort_retention_monthly',
    'channel_spend',
    'model_prices',
    'fx_rates',
    'company_inputs_quarterly',
    'provider_invoices',
    'ops_settings',
    'alerts',
    'feature_flag_mirror',
    'admin_actions',
    'audit_log',
    'gdpr_requests',
    'sync_watermarks',
    'ingest_dead_letter',
    'reconciliation_issues',
    'scraper_health_states',
  ]
  for (const t of tables) sqlite.prepare(`DELETE FROM ${t}`).run()
}

// ---------- seed staff users ----------
function seedStaff() {
  const hash = bcrypt.hashSync('admin', 4)
  const roles: { id: string; email: string; name: string; role: Role }[] = [
    { id: 'staff_owner', email: 'owner@clovion.ai', name: 'Owner', role: 'owner' },
    { id: 'staff_admin', email: 'admin@clovion.ai', name: 'Admin', role: 'admin' },
    {
      id: 'staff_analyst',
      email: 'analyst@clovion.ai',
      name: 'Analyst',
      role: 'analyst',
    },
    {
      id: 'staff_support',
      email: 'support@clovion.ai',
      name: 'Support',
      role: 'support',
    },
    {
      id: 'staff_engineer',
      email: 'engineer@clovion.ai',
      name: 'Engineer',
      role: 'engineer',
    },
  ]
  for (const u of roles) {
    db.insert(schema.staffUsers)
      .values({
        id: u.id,
        email: u.email,
        name: u.name,
        passwordHash: hash,
        role: u.role,
        active: true,
        createdAt: new Date(REFERENCE_TS - 90 * DAY_MS),
        lastLoginAt: new Date(REFERENCE_TS - randInt(1, 48) * HOUR_MS),
      })
      .run()
  }
}

// ---------- seed accounts/users/workspaces/subscriptions ----------
type SeededAccount = {
  id: string
  name: string
  type: AccountType
  planTier: PlanTier
  status: 'active' | 'churned' | 'trialing'
  createdAt: number
  churnedAt: number | null
  mrr: number
  workspaceCount: number
}

function seedAccounts(): SeededAccount[] {
  const accountsList: SeededAccount[] = []
  const plans: { tier: PlanTier; count: number }[] = [
    { tier: 'free', count: 8 },
    { tier: 'starter', count: 12 },
    { tier: 'growth', count: 8 },
    { tier: 'enterprise', count: 4 },
  ]
  let idx = 0
  for (const { tier, count } of plans) {
    for (let i = 0; i < count; i++) {
      idx++
      const type: AccountType = rand() < 0.35 ? 'agency' : 'brand'
      const createdAt = REFERENCE_TS - randInt(20, 360) * DAY_MS
      const status: SeededAccount['status'] =
        rand() < 0.05 && tier !== 'free' ? 'churned' : 'active'
      const churnedAt =
        status === 'churned' ? createdAt + randInt(60, 180) * DAY_MS : null
      const baseMrr = PLAN_MRR[tier]
      const mrr =
        tier === 'free'
          ? 0
          : status === 'churned'
            ? 0
            : Math.round(baseMrr * (0.9 + rand() * 0.3))
      const workspaceCount =
        type === 'agency' ? randInt(3, 12) : randInt(1, 3)

      const id = uid('acct', idx)
      const name = `${type === 'agency' ? 'Agency' : 'Brand'} ${idx.toString().padStart(2, '0')}`
      accountsList.push({
        id,
        name,
        type,
        planTier: tier,
        status,
        createdAt,
        churnedAt,
        mrr,
        workspaceCount,
      })

      const trackedPromptsLimit =
        tier === 'free'
          ? 5
          : tier === 'starter'
            ? 25
            : tier === 'growth'
              ? 100
              : 500
      const enginesLimit =
        tier === 'free' ? 1 : tier === 'starter' ? 3 : tier === 'growth' ? 6 : 9

      db.insert(schema.accounts)
        .values({
          id,
          name,
          type,
          planTier: tier,
          status,
          stripeCustomerId: tier === 'free' ? null : `cus_${id}`,
          createdAt: new Date(createdAt),
          churnedAt: churnedAt ? new Date(churnedAt) : null,
          country: pick(['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'NL']),
          ownerUserId: null,
          workspaceCount,
          trackedPromptsLimit,
          enginesLimit,
          mrrUsdCents: mrr,
          syncedAt: new Date(REFERENCE_TS),
        })
        .run()

      // users for this account
      const userCount =
        type === 'agency' ? randInt(3, 8) : randInt(1, 4)
      for (let u = 0; u < userCount; u++) {
        const uId = `${id}_u${u}`
        db.insert(schema.users)
          .values({
            id: uId,
            accountId: id,
            email: `user${u}@${id}.demo`,
            name: `User ${u + 1} (${name})`,
            roleInAccount: u === 0 ? 'owner' : pick(['admin', 'member']),
            isInternal: false,
            createdAt: new Date(createdAt + u * DAY_MS),
            lastSeenAt: new Date(
              REFERENCE_TS - randInt(0, 14) * DAY_MS
            ),
            deletedAt: null,
            syncedAt: new Date(REFERENCE_TS),
          })
          .run()
      }

      // workspaces
      for (let w = 0; w < workspaceCount; w++) {
        const wsId = `${id}_ws${w}`
        const enabledEngines = ENGINES.slice(
          0,
          Math.min(enginesLimit, 1 + Math.floor(rand() * enginesLimit))
        )
        db.insert(schema.workspaces)
          .values({
            id: wsId,
            accountId: id,
            clientName:
              type === 'agency' ? `Client ${w + 1}` : `Workspace ${w + 1}`,
            createdAt: new Date(createdAt + w * 2 * DAY_MS),
            promptCount: randInt(5, trackedPromptsLimit),
            enginesEnabled: JSON.stringify(enabledEngines),
          })
          .run()
      }

      // subscription
      if (tier !== 'free') {
        const subId = `sub_${id}`
        db.insert(schema.subscriptions)
          .values({
            id: subId,
            accountId: id,
            status: status === 'churned' ? 'canceled' : 'active',
            planTier: tier,
            interval: rand() < 0.2 ? 'year' : 'month',
            quantity: 1,
            mrrUsdCents: mrr,
            currency: 'USD',
            trialStart: new Date(createdAt - 14 * DAY_MS),
            trialEnd: new Date(createdAt),
            currentPeriodStart: new Date(REFERENCE_TS - 14 * DAY_MS),
            currentPeriodEnd: new Date(REFERENCE_TS + 14 * DAY_MS),
            canceledAt: churnedAt ? new Date(churnedAt) : null,
            cancelReasonCode: (churnedAt
              ? (pick([
                  'too_expensive',
                  'missing_engine',
                  'not_enough_value',
                  'switched_competitor',
                  'project_ended',
                ]) as ReasonCode)
              : null) as ReasonCode | null,
            syncedAt: new Date(REFERENCE_TS),
          })
          .run()
      }
    }
  }
  return accountsList
}

// ---------- subscription events (60d) ----------
function seedSubscriptionEvents(accts: SeededAccount[]) {
  const types: { value: SubEventType; weight: number }[] = [
    { value: 'new', weight: 10 },
    { value: 'expansion', weight: 8 },
    { value: 'contraction', weight: 5 },
    { value: 'churn', weight: 3 },
    { value: 'reactivation', weight: 1 },
    { value: 'discount_change', weight: 2 },
  ]
  let id = 0
  for (let d = 0; d < 60; d++) {
    const day = REFERENCE_TS - (60 - d) * DAY_MS
    const eventsThisDay = randInt(0, 2)
    for (let e = 0; e < eventsThisDay; e++) {
      id++
      const t = pickWeighted(types)
      const acct = pick(accts.filter((a) => a.planTier !== 'free'))
      if (!acct) continue
      const subId = `sub_${acct.id}`
      const delta =
        t === 'new'
          ? acct.mrr
          : t === 'expansion'
            ? Math.round(acct.mrr * 0.3)
            : t === 'contraction'
              ? -Math.round(acct.mrr * 0.2)
              : t === 'churn'
                ? -acct.mrr
                : t === 'reactivation'
                  ? acct.mrr
                  : 0
      db.insert(schema.subscriptionEvents)
        .values({
          id: uid('se', id),
          occurredAt: new Date(day + randInt(0, 23) * HOUR_MS),
          accountId: acct.id,
          subscriptionId: subId,
          type: t,
          source: 'snapshot_diff',
          mrrDeltaUsdCents: delta,
          fromPlan: t === 'expansion' ? 'starter' : t === 'contraction' ? 'growth' : null,
          toPlan: t === 'expansion' ? 'growth' : t === 'contraction' ? 'starter' : acct.planTier,
          stripeEventId: `evt_${id}_${Math.floor(rand() * 1e9)}`,
          raw: '{}',
        })
        .run()
    }
  }
}

// ---------- Stripe invoices in dunning + paid ----------
function seedInvoices(accts: SeededAccount[]) {
  const paying = accts.filter((a) => a.planTier !== 'free' && a.status === 'active')
  let id = 0
  // 6 in dunning
  const dunning = paying.slice(0, 6)
  for (const a of dunning) {
    id++
    db.insert(schema.stripeInvoices)
      .values({
        id: uid('inv', id),
        accountId: a.id,
        amountUsdCents: a.mrr,
        feeUsdCents: Math.round(a.mrr * 0.029) + 30,
        status: 'open',
        paidAt: null,
        attemptCount: randInt(1, 4),
        nextPaymentAttempt: new Date(REFERENCE_TS + randInt(1, 5) * DAY_MS),
        daysDelinquent: randInt(1, 14),
        createdAt: new Date(REFERENCE_TS - randInt(2, 14) * DAY_MS),
      })
      .run()
  }
  // paid invoices, 2 per paying account over 60d
  for (const a of paying) {
    for (let m = 0; m < 2; m++) {
      id++
      const created = REFERENCE_TS - (m + 1) * 30 * DAY_MS
      db.insert(schema.stripeInvoices)
        .values({
          id: uid('inv', id),
          accountId: a.id,
          amountUsdCents: a.mrr,
          feeUsdCents: Math.round(a.mrr * 0.029) + 30,
          status: 'paid',
          paidAt: new Date(created + DAY_MS),
          attemptCount: 1,
          nextPaymentAttempt: null,
          daysDelinquent: 0,
          createdAt: new Date(created),
        })
        .run()
    }
  }
  // balance transactions
  for (let i = 0; i < 80; i++) {
    db.insert(schema.stripeBalanceTxns)
      .values({
        id: uid('bt', i),
        type: pick(['charge', 'refund', 'adjustment']),
        accountId: pick(paying).id,
        amountUsdCents: randInt(2000, 50000),
        feeUsdCents: randInt(60, 1500),
        occurredAt: new Date(REFERENCE_TS - randInt(0, 60) * DAY_MS),
      })
      .run()
  }
}

// ---------- usage events ----------
function seedUsageEvents(accts: SeededAccount[]) {
  const insert = sqlite.prepare(
    `INSERT INTO usage_events (event_id, event_name, occurred_at, received_at, account_id, user_id, anonymous_id, session_id, source, lane, schema_version, properties, is_impersonated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const txn = sqlite.transaction(() => {
    let id = 0
    const TARGET = 30_000
    for (let i = 0; i < TARGET; i++) {
      id++
      const acct = pick(accts)
      const day = REFERENCE_TS - randInt(0, 60) * DAY_MS - randInt(0, 23) * HOUR_MS
      const name = pickWeighted([
        { value: 'page_viewed', weight: 35 },
        { value: 'dashboard_viewed', weight: 12 },
        { value: 'report_viewed', weight: 9 },
        { value: 'prompt_created', weight: 6 },
        { value: 'engine_connected', weight: 4 },
        { value: 'prompt_run_completed_first', weight: 3 },
        { value: 'user_signed_up', weight: 3 },
        { value: 'workspace_created', weight: 2 },
        { value: 'report_exported', weight: 4 },
        { value: 'alert_configured', weight: 2 },
        { value: 'api_used', weight: 5 },
        { value: 'mcp_used', weight: 3 },
        { value: 'feature_used', weight: 6 },
        { value: 'onboarding_step_completed', weight: 3 },
        { value: 'trial_started', weight: 1 },
        { value: 'checkout_started', weight: 1 },
        { value: 'subscription_started', weight: 1 },
      ])
      const userId = `${acct.id}_u${randInt(0, 3)}`
      const anonId = `anon_${randInt(1, 5000)}`
      insert.run(
        uid('ev', id),
        name,
        day,
        day + 1000,
        acct.id,
        userId,
        anonId,
        `sess_${randInt(1, 10000)}`,
        pick(['web', 'server', 'pipeline', 'billing']),
        rand() < 0.9 ? 'posthog' : 'direct',
        1,
        '{}',
        0
      )
    }
  })
  txn()
}

// ---------- pipeline runs ----------
function seedPipelineRuns(accts: SeededAccount[]) {
  const failureClasses: { value: FailureClass; weight: number }[] = [
    { value: 'scrape_block', weight: 35 },
    { value: 'rate_limit', weight: 25 },
    { value: 'llm_error', weight: 15 },
    { value: 'parse', weight: 10 },
    { value: 'auth', weight: 5 },
    { value: 'timeout', weight: 5 },
    { value: 'infra', weight: 5 },
  ]
  const insert = sqlite.prepare(
    `INSERT INTO pipeline_runs (run_id, scheduled_for, account_id, workspace_id, engine, prompt_id, started_at, finished_at, status, failure_class, skip_cause, latency_ms, retries, tokens_in, tokens_out, model, cost_usd_microcents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const ledgerInsert = sqlite.prepare(
    `INSERT INTO llm_cost_ledger (id, occurred_at, account_id, engine, feature, provider, model, tokens_in, tokens_out, cost_source, unit_price_version, cost_usd_microcents, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const TARGET = 60_000
  const txn = sqlite.transaction(() => {
    let id = 0
    let ledgerId = 0
    for (let i = 0; i < TARGET; i++) {
      id++
      const acct = pick(accts)
      const engine = pick(ENGINES)
      const day = REFERENCE_TS - randInt(0, 60) * DAY_MS - randInt(0, 23) * HOUR_MS
      const roll = rand()
      let status: PipelineStatus
      let failureClass: FailureClass | null = null
      let skipCause: 'quota' | 'kill_switch' | null = null
      if (roll < 0.95) status = 'success'
      else if (roll < 0.98) {
        status = 'failed'
        failureClass = pickWeighted(failureClasses)
      } else {
        status = 'skipped'
        skipCause = pick(['quota', 'kill_switch'])
      }
      const latency = randInt(500, 12000)
      const tokensIn = status === 'success' ? randInt(800, 4000) : 0
      const tokensOut = status === 'success' ? randInt(200, 1200) : 0
      const provider =
        engine === 'chatgpt'
          ? 'openai'
          : engine === 'claude'
            ? 'anthropic'
            : engine === 'gemini' || engine === 'google_aio'
              ? 'google'
              : engine === 'perplexity'
                ? 'perplexity'
                : 'microsoft'
      const model =
        provider === 'openai'
          ? 'gpt-4o'
          : provider === 'anthropic'
            ? 'claude-3-5-sonnet'
            : provider === 'google'
              ? 'gemini-1.5-pro'
              : provider === 'perplexity'
                ? 'pplx-70b'
                : 'copilot-pro'
      const cost =
        status === 'success'
          ? tokensIn * 3 + tokensOut * 10 // microcents-ish
          : 0

      const runId = uid('run', id)
      insert.run(
        runId,
        day,
        acct.id,
        `${acct.id}_ws0`,
        engine,
        `prompt_${randInt(1, 500)}`,
        day + 100,
        day + 100 + latency,
        status,
        failureClass,
        skipCause,
        latency,
        randInt(0, 3),
        tokensIn,
        tokensOut,
        model,
        cost
      )

      if (status === 'success' && cost > 0) {
        ledgerId++
        ledgerInsert.run(
          uid('lg', ledgerId),
          day + 100 + latency,
          acct.id,
          engine,
          'prompt_run',
          provider,
          model,
          tokensIn,
          tokensOut,
          rand() < 0.7 ? 'ingested' : 'inferred',
          1,
          cost,
          runId
        )

        // platform slice ~2%
        if (rand() < 0.02) {
          ledgerId++
          ledgerInsert.run(
            uid('lg', ledgerId),
            day + 100 + latency,
            '__platform__',
            engine,
            'other',
            provider,
            model,
            Math.round(tokensIn * 0.1),
            Math.round(tokensOut * 0.1),
            'inferred',
            1,
            Math.round(cost * 0.1),
            null
          )
        }
      }
    }
  })
  txn()
}

// ---------- NPS, tickets ----------
function seedSupportAndNps(accts: SeededAccount[]) {
  const insertTicket = sqlite.prepare(
    `INSERT INTO support_tickets_mirror (ticket_id, source_tool, account_id, user_id, status, priority, created_at, first_response_minutes, resolved_at, csat_score, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const txn = sqlite.transaction(() => {
    for (let i = 0; i < 800; i++) {
      const acct = pick(accts)
      const created = REFERENCE_TS - randInt(0, 60) * DAY_MS
      const status = pick<TicketStatus>([
        'open',
        'pending',
        'solved',
        'closed',
        'solved',
        'closed',
      ])
      const priority = pickWeighted<TicketPriority>([
        { value: 'low', weight: 30 },
        { value: 'normal', weight: 50 },
        { value: 'high', weight: 15 },
        { value: 'urgent', weight: 5 },
      ])
      const frt = randInt(5, 360)
      const resolvedAt =
        status === 'solved' || status === 'closed'
          ? created + randInt(1, 96) * HOUR_MS
          : null
      const csat = resolvedAt && rand() < 0.6 ? randInt(1, 5) : null
      insertTicket.run(
        uid('tkt', i),
        pick(['intercom', 'zendesk', 'plain']),
        acct.id,
        `${acct.id}_u0`,
        status,
        priority,
        created,
        frt,
        resolvedAt,
        csat,
        JSON.stringify([pick(['billing', 'pipeline', 'engine', 'onboarding'])])
      )
    }

    for (let i = 0; i < 1500; i++) {
      const acct = pick(accts)
      const score = pickWeighted([
        { value: 9, weight: 20 },
        { value: 10, weight: 18 },
        { value: 8, weight: 22 },
        { value: 7, weight: 14 },
        { value: 6, weight: 8 },
        { value: 5, weight: 6 },
        { value: 4, weight: 4 },
        { value: 3, weight: 3 },
        { value: 2, weight: 2 },
        { value: 1, weight: 2 },
        { value: 0, weight: 1 },
      ])
      db.insert(schema.npsResponses)
        .values({
          id: uid('nps', i),
          userId: `${acct.id}_u0`,
          accountId: acct.id,
          score,
          comment:
            score >= 9 ? 'love it' : score <= 6 ? 'needs work' : null,
          surveyedAt: new Date(REFERENCE_TS - randInt(0, 90) * DAY_MS),
          source: 'posthog_survey',
        })
        .run()
    }
  })
  txn()
}

// ---------- alerts ----------
function seedAlerts() {
  const metrics = [
    'ai.run_success',
    'rev.delinquent',
    'perf.api_p95',
    'eng.dau',
    'ret.logo_churn',
    'ai.spend',
    'sup.frt',
  ]
  for (let i = 0; i < 40; i++) {
    const fired = REFERENCE_TS - randInt(0, 60) * DAY_MS - randInt(0, 23) * HOUR_MS
    const status = pick<AlertStatus>([
      'open',
      'acked',
      'resolved',
      'resolved',
      'resolved',
    ])
    const severity = pickWeighted<AlertSeverity>([
      { value: 'info', weight: 15 },
      { value: 'warn', weight: 60 },
      { value: 'critical', weight: 25 },
    ])
    db.insert(schema.alerts)
      .values({
        id: uid('alert', i),
        metricKey: pick(metrics),
        dims: '{}',
        severity,
        zScore: 2 + rand() * 3,
        threshold: 0.95,
        status,
        firedAt: new Date(fired),
        ackedAt:
          status !== 'open' ? new Date(fired + randInt(5, 600) * 60_000) : null,
        resolvedAt:
          status === 'resolved'
            ? new Date(fired + randInt(2, 48) * HOUR_MS)
            : null,
        ownerRole: pick<Role>(['owner', 'admin', 'engineer', 'support']),
        slackTs: `${Math.floor(fired / 1000)}.0001`,
      })
      .run()
  }
}

// ---------- audit log (hash-chained) ----------
function seedAuditLog() {
  let prevHash = ''
  const insert = sqlite.prepare(
    `INSERT INTO audit_log (at, actor_staff_id, actor_role, action, object_type, object_id, before_json, after_json, reason, ip, user_agent, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const txn = sqlite.transaction(() => {
    for (let i = 0; i < 200; i++) {
      const at = REFERENCE_TS - (200 - i) * HOUR_MS
      const actor = pick(['staff_owner', 'staff_admin', 'staff_engineer'])
      const role = actor === 'staff_owner' ? 'owner' : actor === 'staff_admin' ? 'admin' : 'engineer'
      const action = pick([
        'login',
        'impersonation_requested',
        'impersonation_approved',
        'plan_override',
        'flag_change',
        'kill_switch',
        'refund_issued',
        'gdpr_processed',
      ])
      const payload = {
        id: i + 1,
        at,
        action,
        actor,
        object_id: `acct_${randInt(1, 32).toString(36).padStart(6, '0')}`,
      }
      const hash = createHash('sha256')
        .update(prevHash + JSON.stringify(payload))
        .digest('hex')
      insert.run(
        at,
        actor,
        role,
        action,
        'account',
        payload.object_id,
        '{}',
        '{}',
        'demo seed',
        '127.0.0.1',
        'seed-script',
        prevHash,
        hash
      )
      prevHash = hash
    }
  })
  txn()
}

// ---------- funnels ----------
function seedFunnels() {
  const defs: Array<{
    id: string
    name: string
    steps: string[]
    windowHours: number
    scope: 'user' | 'account'
  }> = [
    {
      id: 'account_activated_v1',
      name: 'Account Activated',
      steps: [
        'user_signed_up',
        'workspace_created',
        'prompt_created',
        'engine_connected',
        'prompt_run_completed_first',
        'dashboard_viewed',
      ],
      windowHours: 168,
      scope: 'account',
    },
    {
      id: 'visitor_signup_v1',
      name: 'Visitor Signup',
      steps: ['page_viewed', 'page_viewed_pricing', 'user_signed_up'],
      windowHours: 720,
      scope: 'user',
    },
    {
      id: 'free_score_v1',
      name: 'Free Score Lead Magnet',
      steps: [
        'page_viewed',
        'score_requested',
        'score_completed',
        'user_signed_up',
      ],
      windowHours: 168,
      scope: 'user',
    },
    {
      id: 'checkout_v1',
      name: 'Checkout',
      steps: ['checkout_started', 'subscription_started'],
      windowHours: 72,
      scope: 'account',
    },
    {
      id: 'trial_conversion_v1',
      name: 'Trial Conversion',
      steps: [
        'trial_started',
        'prompt_run_completed_first',
        'subscription_started',
      ],
      windowHours: 720,
      scope: 'account',
    },
    {
      id: 'onboarding_steps_v1',
      name: 'Onboarding Steps',
      steps: ['signup', 'workspace', 'prompt', 'engine', 'run'],
      windowHours: 168,
      scope: 'account',
    },
    {
      id: 'report_habit_v1',
      name: 'Report Habit',
      steps: ['dashboard_viewed', 'report_viewed', 'report_exported'],
      windowHours: 168,
      scope: 'user',
    },
    {
      id: 'alerting_adoption_v1',
      name: 'Alerting Adoption',
      steps: ['dashboard_viewed', 'alert_configured'],
      windowHours: 336,
      scope: 'account',
    },
    {
      id: 'integration_adoption_v1',
      name: 'Integration Adoption',
      steps: ['api_key_created', 'api_used'],
      windowHours: 336,
      scope: 'account',
    },
    {
      id: 'cancel_path_v1',
      name: 'Cancel Path',
      steps: ['subscription_canceled'],
      windowHours: 720,
      scope: 'account',
    },
  ]

  for (const d of defs) {
    db.insert(schema.funnelDefinitions)
      .values({
        funnelId: d.id,
        name: d.name,
        steps: JSON.stringify(d.steps),
        windowHours: d.windowHours,
        scope: d.scope,
        owner: 'analyst',
        version: 1,
        active: true,
      })
      .run()
  }

  // 30 days of funnel_results_daily for each
  for (let day = 0; day < 30; day++) {
    const cohortDate = dayOf(REFERENCE_TS - (30 - day) * DAY_MS)
    for (const d of defs) {
      let entered = randInt(20, 80)
      for (let s = 0; s < d.steps.length; s++) {
        const completed = Math.max(1, Math.floor(entered * (0.55 + rand() * 0.35)))
        db.insert(schema.funnelResultsDaily)
          .values({
            funnelId: d.id,
            cohortDate,
            stepIndex: s,
            dims: '{}',
            entered,
            completed,
            conversionPct: completed / entered,
            medianHoursToStep: randInt(1, 48),
          })
          .run()
        entered = completed
      }
    }
  }
}

// ---------- cohort retention 12x12 ----------
function seedCohortRetention() {
  for (let cohort = 0; cohort < 12; cohort++) {
    const cohortMonth = dayOf(REFERENCE_TS - (12 - cohort) * 30 * DAY_MS)
    let accountsStart = randInt(20, 80)
    let mrrStart = randInt(5000_00, 25000_00)
    let mrrRetained = mrrStart
    let accountsRet = accountsStart
    for (let m = 0; m <= 12; m++) {
      const dropAcc = m === 0 ? 0 : Math.floor(accountsRet * (0.02 + rand() * 0.05))
      accountsRet = Math.max(1, accountsRet - dropAcc)
      const dropMrr = m === 0 ? 0 : Math.floor(mrrRetained * (0.03 + rand() * 0.04))
      const expansion = Math.floor(mrrRetained * rand() * 0.05)
      mrrRetained = Math.max(0, mrrRetained - dropMrr)
      db.insert(schema.cohortRetentionMonthly)
        .values({
          cohortMonth,
          monthN: m,
          segment: 'all',
          accountsStart,
          accountsRetained: accountsRet,
          grrPct: mrrRetained / mrrStart,
          nrrPct: (mrrRetained + expansion * m) / mrrStart,
          mrrStartUsdCents: mrrStart,
          mrrRetainedUsdCents: mrrRetained,
          mrrExpansionUsdCents: expansion * m,
        })
        .run()
    }
  }
}

// ---------- daily metrics / rollups ----------
function seedDailyMetrics(accts: SeededAccount[]) {
  const insertAcct = sqlite.prepare(
    `INSERT OR REPLACE INTO account_metrics_daily (account_id, date, dau, events, features_used, prompt_runs, token_cost_usd_microcents, mrr_usd_cents, margin_usd_cents, health_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertRollup = sqlite.prepare(
    `INSERT OR REPLACE INTO metric_rollup_daily (metric_key, date_reporting_tz, dims, value, numerator, denominator, computed_at, definitions_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const txn = sqlite.transaction(() => {
    for (let d = 0; d < 60; d++) {
      const date = dayOf(REFERENCE_TS - (60 - d) * DAY_MS)
      const computedAt = REFERENCE_TS
      let dailyDau = 0
      let dailyEvents = 0
      let dailyMrr = 0
      let dailyMargin = 0
      let dailyRuns = 0
      let dailyTokenCost = 0
      let dailySignups = 0
      let dailySpend = 0
      let dailyTokens = 0
      let dailySuccess = 0
      let dailyAttempted = 0

      for (const a of accts) {
        const dau = randInt(1, Math.max(2, Math.floor(a.workspaceCount * 1.5)))
        const events = dau * randInt(5, 25)
        const runs = randInt(2, 20)
        const tokenCost = runs * randInt(50_000, 300_000)
        const stripeFees = Math.round(a.mrr * 0.029) + 30
        const infraConst = 300
        const dailyMrrAcct = Math.round(a.mrr / 30)
        const margin = dailyMrrAcct - Math.round(tokenCost / 10_000) - infraConst - Math.round(stripeFees / 30)
        insertAcct.run(
          a.id,
          date,
          dau,
          events,
          JSON.stringify(['dashboards', 'reports']),
          runs,
          tokenCost,
          a.mrr,
          margin,
          randInt(40, 100)
        )
        dailyDau += dau
        dailyEvents += events
        dailyMrr += a.mrr
        dailyMargin += margin
        dailyRuns += runs
        dailyTokenCost += tokenCost
      }

      dailySignups = randInt(2, 12)
      dailySpend = dailyTokenCost
      dailyTokens = dailyRuns * 3000
      dailySuccess = Math.floor(dailyRuns * (0.94 + rand() * 0.05))
      dailyAttempted = dailyRuns

      const put = (key: string, value: number, num = 0, den = 0) =>
        insertRollup.run(key, date, '{}', value, num, den, computedAt, 1)

      put('eng.dau', dailyDau)
      put('eng.acct_dau', accts.length)
      put('rev.mrr', dailyMrr)
      put('rev.arr', dailyMrr * 12)
      put('rev.delinquent', randInt(20000, 80000))
      put('acq.signups', dailySignups)
      put('acq.visitors', randInt(1500, 4000))
      put('acq.sessions', randInt(2500, 6000))
      put('ai.spend', dailySpend)
      put('ai.tokens', dailyTokens)
      put('ai.run_success', dailySuccess / Math.max(1, dailyAttempted), dailySuccess, dailyAttempted)
      put('ai.freshness', 0.98 + rand() * 0.015)
      put('ai.margin', dailyMargin)
      put('ai.cost_per_run', dailySpend / Math.max(1, dailyRuns))
      put('ai.free_burn', Math.floor(dailySpend * 0.08))
      put('perf.api_p50', randInt(80, 180))
      put('perf.api_p95', randInt(250, 800))
      put('perf.api_p99', randInt(700, 1800))
      put('perf.error_rate', 0.001 + rand() * 0.004)
      put('perf.uptime', 0.997 + rand() * 0.003)
      put('perf.lcp', 1800 + rand() * 800)
      put('perf.inp', 120 + rand() * 80)
      put('perf.cls', 0.05 + rand() * 0.06)
      put('sup.tickets', randInt(5, 22))
      put('sup.frt', 30 + rand() * 60)
      put('sup.csat', 0.82 + rand() * 0.1)
      put('ret.logo_churn', 0.01 + rand() * 0.02)
      put('ret.nrr_ttm', 1.0 + rand() * 0.1)
      put('ret.nrr_m', 1.0 + rand() * 0.04)
      put('ret.grr', 0.85 + rand() * 0.08)
      put('rev.cac_payback', 18 + rand() * 12)
      put('rev.expansion_share', 0.35 + rand() * 0.15)
      put('rev.arpa', dailyMrr / Math.max(1, accts.filter((x) => x.mrr > 0).length))
      put('rev.trial_cvr', 0.18 + rand() * 0.08)
      put('eng.stick_wm', 0.42 + rand() * 0.08)
      put('eng.stick_dm', 0.28 + rand() * 0.05)
    }
  })
  txn()
}

// ---------- channel spend, model prices, fx ----------
function seedReferences() {
  const months = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06']
  for (const m of months) {
    for (const c of CHANNELS) {
      db.insert(schema.channelSpend)
        .values({
          month: m,
          channel: c,
          spendUsdCents: randInt(50_000, 800_000),
          source: 'csv_import',
          importedBy: 'staff_owner',
        })
        .run()
    }
  }

  const models = [
    { provider: 'openai', model: 'gpt-4o', in: 2500, out: 10000 },
    { provider: 'anthropic', model: 'claude-3-5-sonnet', in: 3000, out: 15000 },
    { provider: 'google', model: 'gemini-1.5-pro', in: 1250, out: 5000 },
    { provider: 'perplexity', model: 'pplx-70b', in: 1000, out: 1000 },
    { provider: 'microsoft', model: 'copilot-pro', in: 5000, out: 15000 },
  ]
  for (const m of models) {
    db.insert(schema.modelPrices)
      .values({
        provider: m.provider,
        model: m.model,
        validFrom: new Date(REFERENCE_TS - 365 * DAY_MS),
        inputPricePerMtokUsdMicrocents: m.in,
        outputPricePerMtokUsdMicrocents: m.out,
        version: 1,
      })
      .run()
  }

  for (let d = 0; d < 60; d++) {
    const date = dayOf(REFERENCE_TS - (60 - d) * DAY_MS)
    for (const cur of ['USD', 'EUR', 'GBP']) {
      db.insert(schema.fxRates)
        .values({
          date,
          currency: cur,
          usdRate: cur === 'USD' ? 1 : cur === 'EUR' ? 1.08 + rand() * 0.04 : 1.26 + rand() * 0.04,
        })
        .run()
    }
  }

  const quarters = [quarterKey(REFERENCE_TS - 90 * DAY_MS), quarterKey(REFERENCE_TS)]
  for (const q of quarters) {
    db.insert(schema.companyInputsQuarterly)
      .values({
        quarter: q,
        smExpenseUsdCents: randInt(80_000_00, 180_000_00),
        grossMarginPct: 0.72,
        fcfMarginPct: 0.05,
        enteredBy: 'staff_owner',
        enteredAt: new Date(REFERENCE_TS),
      })
      .run()
  }

  const providers = ['openai', 'anthropic', 'google', 'perplexity']
  for (const p of providers) {
    for (const m of months) {
      db.insert(schema.providerInvoices)
        .values({
          provider: p,
          month: m,
          amountUsdCents: randInt(50_000_00, 200_000_00),
          enteredBy: 'staff_owner',
          enteredAt: new Date(REFERENCE_TS),
        })
        .run()
    }
  }
}

// ---------- ops settings, flags, sync watermarks ----------
function seedOpsAndFlags() {
  const settings: Array<{ key: string; value: unknown }> = [
    { key: 'llm_daily_budget_usd_cents', value: 50_000 },
    { key: 'infra_allocation_usd_cents_per_account_day', value: 300 },
    { key: 'anomaly_thresholds', value: { z_score: 3 } },
    { key: 'free_burn_cap_usd_cents', value: 20_000 },
  ]
  for (const s of settings) {
    db.insert(schema.opsSettings)
      .values({
        key: s.key,
        value: JSON.stringify(s.value),
        updatedBy: 'staff_owner',
        updatedAt: new Date(REFERENCE_TS),
      })
      .run()
  }

  const flags = [
    { key: 'new_dashboard', desc: 'Toggle new dashboard layout' },
    { key: 'export_csv', desc: 'Enable CSV export' },
    { key: 'agency_view', desc: 'Agency multi-tenant view' },
    { key: 'cost_attribution_v2', desc: 'V2 cost attribution algorithm' },
    { key: 'sentiment_v2', desc: 'V2 sentiment model' },
    { key: 'beta_engines', desc: 'Enable beta engines (Grok/DeepSeek)' },
    { key: 'kill_switch_engine_chatgpt', desc: 'Engine kill-switch ChatGPT' },
    { key: 'kill_switch_global', desc: 'Global pipeline kill-switch' },
  ]
  for (const f of flags) {
    db.insert(schema.featureFlagMirror)
      .values({
        flagKey: f.key,
        description: f.desc,
        state: JSON.stringify({
          enabled: rand() < 0.6,
          rollout: Math.round(rand() * 100),
        }),
        lastChangedBy: 'staff_admin',
        lastChangedAt: new Date(REFERENCE_TS - randInt(1, 30) * DAY_MS),
        lastChangeReason: 'demo seed',
      })
      .run()
  }

  const watermarks = [
    { source: 'events', lag: 1800 },
    { source: 'stripe', lag: 3600 },
    { source: 'replica', lag: 7200 },
    { source: 'posthog', lag: 1800 },
    { source: 'support', lag: 14400 },
    { source: 'pipeline', lag: 600 },
  ]
  for (const w of watermarks) {
    db.insert(schema.syncWatermarks)
      .values({
        source: w.source,
        lastSyncedAt: new Date(REFERENCE_TS - w.lag * 1000),
        lastId: null,
        rowsLastRun: randInt(100, 5000),
        lagSeconds: w.lag,
      })
      .run()
  }

  for (const e of ENGINES) {
    db.insert(schema.scraperHealthStates)
      .values({
        engine: e,
        state: pickWeighted([
          { value: 'green' as const, weight: 80 },
          { value: 'amber' as const, weight: 15 },
          { value: 'red' as const, weight: 5 },
        ]),
        detectorContext: 'demo',
        changedAt: new Date(REFERENCE_TS - randInt(0, 7) * DAY_MS),
      })
      .run()
  }
}

// ---------- admin actions ----------
function seedAdminActions(accts: SeededAccount[]) {
  const types: AdminActionType[] = [
    'impersonation',
    'plan_override',
    'refund',
    'credit',
    'kill_switch',
    'flag_change',
    'gdpr',
  ]
  for (let i = 0; i < 30; i++) {
    const t = pick(types)
    const status = pick<AdminActionStatus>([
      'requested',
      'approved',
      'executed',
      'failed',
      'expired',
    ])
    db.insert(schema.adminActions)
      .values({
        id: uid('aa', i),
        type: t,
        status,
        requestedBy: pick(['staff_admin', 'staff_support', 'staff_engineer']),
        approvedBy:
          status === 'requested' ? null : 'staff_owner',
        targetAccountId: pick(accts).id,
        params: JSON.stringify({ reason: 'demo seed', ticket: `T-${i}` }),
        expiresAt: t === 'impersonation' ? new Date(REFERENCE_TS + DAY_MS) : null,
        productApiResponse: null,
        createdAt: new Date(REFERENCE_TS - randInt(0, 30) * DAY_MS),
        updatedAt: new Date(REFERENCE_TS - randInt(0, 7) * DAY_MS),
      })
      .run()
  }
}

// ---------- GDPR requests ----------
function seedGdpr(accts: SeededAccount[]) {
  for (let i = 0; i < 6; i++) {
    const received = REFERENCE_TS - randInt(2, 25) * DAY_MS
    const status = pick(['open', 'in_progress', 'completed', 'completed'] as const)
    db.insert(schema.gdprRequests)
      .values({
        id: uid('dsr', i),
        type: pick(['delete', 'export'] as const),
        accountId: pick(accts).id,
        userId: null,
        receivedAt: new Date(received),
        deadlineAt: new Date(received + 30 * DAY_MS),
        status,
        steps: JSON.stringify([
          { step: 'product_purge', done: status !== 'open' },
          { step: 'console_purge', done: status === 'completed' },
        ]),
        completedAt:
          status === 'completed'
            ? new Date(received + randInt(5, 20) * DAY_MS)
            : null,
      })
      .run()
  }
}

// ---------- reconciliation issues ----------
function seedReconciliation() {
  for (let i = 0; i < 4; i++) {
    const opened = REFERENCE_TS - randInt(1, 14) * DAY_MS
    const status = pick(['open', 'resolved'] as const)
    db.insert(schema.reconciliationIssues)
      .values({
        id: uid('rec', i),
        date: dayOf(opened),
        domain: pick(['stripe_mrr', 'provider_invoice'] as const),
        accountId: null,
        expectedUsdCents: randInt(50_000_00, 200_000_00),
        actualUsdCents: randInt(48_000_00, 202_000_00),
        deltaUsdCents: randInt(-5000_00, 5000_00),
        status,
        openedAt: new Date(opened),
        resolvedAt:
          status === 'resolved'
            ? new Date(opened + randInt(1, 7) * DAY_MS)
            : null,
      })
      .run()
  }
}

// ---------- run ----------
function main() {
  console.log('seeding console.db with deterministic data...')
  truncateAll()
  seedStaff()
  const accts = seedAccounts()
  seedSubscriptionEvents(accts)
  seedInvoices(accts)
  seedUsageEvents(accts)
  seedPipelineRuns(accts)
  seedSupportAndNps(accts)
  seedAlerts()
  seedAuditLog()
  seedFunnels()
  seedCohortRetention()
  seedDailyMetrics(accts)
  seedReferences()
  seedOpsAndFlags()
  seedAdminActions(accts)
  seedGdpr(accts)
  seedReconciliation()
  console.log('seed complete →', url)
  sqlite.close()
}

main()
