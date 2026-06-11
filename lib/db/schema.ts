// SQLite schema for the Clovion Console — Drizzle ORM.
// Tables follow PRD §4.3 (data model) and §A (metrics dictionary).
// Money: *_usd_cents (integer). LLM cost: *_usd_microcents (integer).
// Timestamps: integer({ mode: 'timestamp_ms' }).

import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import type {
  Role,
  AccountType,
  PlanTier,
  AccountStatus,
  SubscriptionStatus,
  SubscriptionInterval,
  EngineKey,
  EventSource,
  IngestLane,
  PipelineStatus,
  FailureClass,
  SkipCause,
  CostSource,
  SubEventType,
  SubEventSource,
  InvoiceStatus,
  TicketStatus,
  TicketPriority,
  FunnelScope,
  AlertSeverity,
  AlertStatus,
  AdminActionType,
  AdminActionStatus,
  GdprType,
  GdprStatus,
  ReconciliationDomain,
  ReconciliationStatus,
  ScraperHealthState,
  ChannelSpendSource,
  LedgerFeature,
  ChannelClass,
  ReasonCode,
} from './types'

// --- staff & auth -----------------------------------------------------------

export const staffUsers = sqliteTable('staff_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  role: text('role').$type<Role>().notNull().default('analyst'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
})

// --- accounts / users / workspaces / subscriptions --------------------------

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').$type<AccountType>().notNull(),
    planTier: text('plan_tier').$type<PlanTier>().notNull(),
    status: text('status').$type<AccountStatus>().notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    churnedAt: integer('churned_at', { mode: 'timestamp_ms' }),
    country: text('country'),
    ownerUserId: text('owner_user_id'),
    workspaceCount: integer('workspace_count').notNull().default(1),
    trackedPromptsLimit: integer('tracked_prompts_limit').notNull().default(50),
    enginesLimit: integer('engines_limit').notNull().default(3),
    mrrUsdCents: integer('mrr_usd_cents').notNull().default(0),
    syncedAt: integer('synced_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    byPlan: index('accounts_by_plan').on(t.planTier),
    byStatus: index('accounts_by_status').on(t.status),
    byCreated: index('accounts_by_created').on(t.createdAt),
  })
)

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    roleInAccount: text('role_in_account').notNull(),
    isInternal: integer('is_internal', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    syncedAt: integer('synced_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    byAccount: index('users_by_account').on(t.accountId),
    byEmail: index('users_by_email').on(t.email),
  })
)

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    clientName: text('client_name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    promptCount: integer('prompt_count').notNull().default(0),
    enginesEnabled: text('engines_enabled').notNull().default('[]'),
  },
  (t) => ({
    byAccount: index('workspaces_by_account').on(t.accountId),
  })
)

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    status: text('status').$type<SubscriptionStatus>().notNull(),
    planTier: text('plan_tier').$type<PlanTier>().notNull(),
    interval: text('interval').$type<SubscriptionInterval>().notNull(),
    quantity: integer('quantity').notNull().default(1),
    mrrUsdCents: integer('mrr_usd_cents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    trialStart: integer('trial_start', { mode: 'timestamp_ms' }),
    trialEnd: integer('trial_end', { mode: 'timestamp_ms' }),
    currentPeriodStart: integer('current_period_start', { mode: 'timestamp_ms' }),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }),
    canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
    cancelReasonCode: text('cancel_reason_code').$type<ReasonCode>(),
    syncedAt: integer('synced_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    byAccount: index('subscriptions_by_account').on(t.accountId),
    byStatus: index('subscriptions_by_status').on(t.status),
  })
)

// --- usage events / identity map -------------------------------------------

export const usageEvents = sqliteTable(
  'usage_events',
  {
    eventId: text('event_id').primaryKey(),
    eventName: text('event_name').notNull(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
    accountId: text('account_id'),
    userId: text('user_id'),
    anonymousId: text('anonymous_id'),
    sessionId: text('session_id'),
    source: text('source').$type<EventSource>().notNull(),
    lane: text('lane').$type<IngestLane>().notNull().default('posthog'),
    schemaVersion: integer('schema_version').notNull().default(1),
    properties: text('properties').notNull().default('{}'),
    isImpersonated: integer('is_impersonated', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (t) => ({
    byNameTime: index('events_by_name_time').on(t.eventName, t.occurredAt),
    byAcctTime: index('events_by_account_time').on(t.accountId, t.occurredAt),
    byUserTime: index('events_by_user_time').on(t.userId, t.occurredAt),
  })
)

export const identityMap = sqliteTable(
  'identity_map',
  {
    anonymousId: text('anonymous_id').notNull(),
    userId: text('user_id').notNull(),
    mergedAt: integer('merged_at', { mode: 'timestamp_ms' }).notNull(),
    source: text('source').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.anonymousId, t.userId] }),
    byUser: index('identity_map_by_user').on(t.userId),
  })
)

// --- pipeline runs / LLM cost ledger ---------------------------------------

export const pipelineRuns = sqliteTable(
  'pipeline_runs',
  {
    runId: text('run_id').primaryKey(),
    scheduledFor: integer('scheduled_for', { mode: 'timestamp_ms' }).notNull(),
    accountId: text('account_id').notNull(),
    workspaceId: text('workspace_id'),
    engine: text('engine').$type<EngineKey>().notNull(),
    promptId: text('prompt_id').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    status: text('status').$type<PipelineStatus>().notNull(),
    failureClass: text('failure_class').$type<FailureClass>(),
    skipCause: text('skip_cause').$type<SkipCause>(),
    latencyMs: integer('latency_ms').notNull().default(0),
    retries: integer('retries').notNull().default(0),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    model: text('model').notNull().default(''),
    costUsdMicrocents: integer('cost_usd_microcents').notNull().default(0),
  },
  (t) => ({
    byEngineTime: index('runs_by_engine_time').on(t.engine, t.scheduledFor),
    byAcctTime: index('runs_by_account_time').on(t.accountId, t.scheduledFor),
    byStatus: index('runs_by_status').on(t.status),
  })
)

export const llmCostLedger = sqliteTable(
  'llm_cost_ledger',
  {
    id: text('id').primaryKey(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    accountId: text('account_id').notNull(),
    engine: text('engine').$type<EngineKey>().notNull(),
    feature: text('feature').$type<LedgerFeature>().notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costSource: text('cost_source').$type<CostSource>().notNull(),
    unitPriceVersion: integer('unit_price_version').notNull().default(1),
    costUsdMicrocents: integer('cost_usd_microcents').notNull().default(0),
    runId: text('run_id'),
  },
  (t) => ({
    byAcctTime: index('ledger_by_account_time').on(t.accountId, t.occurredAt),
    byEngTime: index('ledger_by_engine_time').on(t.engine, t.occurredAt),
    byRunFeature: uniqueIndex('ledger_unique_run_feature').on(t.runId, t.feature),
  })
)

// --- subscription events / Stripe ------------------------------------------

export const subscriptionEvents = sqliteTable(
  'subscription_events',
  {
    id: text('id').primaryKey(),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
    accountId: text('account_id').notNull(),
    subscriptionId: text('subscription_id').notNull(),
    type: text('type').$type<SubEventType>().notNull(),
    source: text('source').$type<SubEventSource>().notNull(),
    mrrDeltaUsdCents: integer('mrr_delta_usd_cents').notNull().default(0),
    fromPlan: text('from_plan').$type<PlanTier>(),
    toPlan: text('to_plan').$type<PlanTier>(),
    stripeEventId: text('stripe_event_id'),
    raw: text('raw').notNull().default('{}'),
  },
  (t) => ({
    byAcctTime: index('subevents_by_account_time').on(t.accountId, t.occurredAt),
    byTypeTime: index('subevents_by_type_time').on(t.type, t.occurredAt),
    uniqStripe: uniqueIndex('subevents_stripe_event_unique').on(t.stripeEventId),
  })
)

export const stripeInvoices = sqliteTable(
  'stripe_invoices',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    amountUsdCents: integer('amount_usd_cents').notNull().default(0),
    feeUsdCents: integer('fee_usd_cents').notNull().default(0),
    status: text('status').$type<InvoiceStatus>().notNull(),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextPaymentAttempt: integer('next_payment_attempt', { mode: 'timestamp_ms' }),
    daysDelinquent: integer('days_delinquent').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    byAcct: index('invoices_by_account').on(t.accountId),
    byStatus: index('invoices_by_status').on(t.status),
  })
)

export const stripeBalanceTxns = sqliteTable(
  'stripe_balance_txns',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    accountId: text('account_id'),
    amountUsdCents: integer('amount_usd_cents').notNull().default(0),
    feeUsdCents: integer('fee_usd_cents').notNull().default(0),
    occurredAt: integer('occurred_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    byTime: index('balance_txns_by_time').on(t.occurredAt),
  })
)

// --- support / NPS ---------------------------------------------------------

export const supportTicketsMirror = sqliteTable(
  'support_tickets_mirror',
  {
    ticketId: text('ticket_id').primaryKey(),
    sourceTool: text('source_tool').notNull(),
    accountId: text('account_id'),
    userId: text('user_id'),
    status: text('status').$type<TicketStatus>().notNull(),
    priority: text('priority').$type<TicketPriority>().notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    firstResponseMinutes: integer('first_response_minutes'),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
    csatScore: integer('csat_score'),
    tags: text('tags').notNull().default('[]'),
  },
  (t) => ({
    byAcct: index('tickets_by_account').on(t.accountId),
    byStatus: index('tickets_by_status').on(t.status),
    byCreated: index('tickets_by_created').on(t.createdAt),
  })
)

export const npsResponses = sqliteTable(
  'nps_responses',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    accountId: text('account_id'),
    score: integer('score').notNull(),
    comment: text('comment'),
    surveyedAt: integer('surveyed_at', { mode: 'timestamp_ms' }).notNull(),
    source: text('source').notNull(),
  },
  (t) => ({
    byTime: index('nps_by_time').on(t.surveyedAt),
    byAcct: index('nps_by_account').on(t.accountId),
  })
)

// --- rollups ---------------------------------------------------------------

export const metricRollupHourly = sqliteTable(
  'metric_rollup_hourly',
  {
    metricKey: text('metric_key').notNull(),
    hourUtc: integer('hour_utc').notNull(),
    dims: text('dims').notNull().default('{}'),
    value: real('value').notNull().default(0),
    numerator: real('numerator').notNull().default(0),
    denominator: real('denominator').notNull().default(0),
    computedAt: integer('computed_at', { mode: 'timestamp_ms' }).notNull(),
    definitionsVersion: integer('definitions_version').notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.metricKey, t.hourUtc, t.dims] }),
    byKey: index('rollup_h_by_key').on(t.metricKey),
  })
)

export const metricRollupDaily = sqliteTable(
  'metric_rollup_daily',
  {
    metricKey: text('metric_key').notNull(),
    dateReportingTz: integer('date_reporting_tz').notNull(),
    dims: text('dims').notNull().default('{}'),
    value: real('value').notNull().default(0),
    numerator: real('numerator').notNull().default(0),
    denominator: real('denominator').notNull().default(0),
    computedAt: integer('computed_at', { mode: 'timestamp_ms' }).notNull(),
    definitionsVersion: integer('definitions_version').notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.metricKey, t.dateReportingTz, t.dims] }),
    byKey: index('rollup_d_by_key').on(t.metricKey),
    byDate: index('rollup_d_by_date').on(t.dateReportingTz),
  })
)

export const accountMetricsDaily = sqliteTable(
  'account_metrics_daily',
  {
    accountId: text('account_id').notNull(),
    date: integer('date').notNull(),
    dau: integer('dau').notNull().default(0),
    events: integer('events').notNull().default(0),
    featuresUsed: text('features_used').notNull().default('[]'),
    promptRuns: integer('prompt_runs').notNull().default(0),
    tokenCostUsdMicrocents: integer('token_cost_usd_microcents')
      .notNull()
      .default(0),
    mrrUsdCents: integer('mrr_usd_cents').notNull().default(0),
    marginUsdCents: integer('margin_usd_cents').notNull().default(0),
    healthScore: integer('health_score').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.accountId, t.date] }),
    byDate: index('account_metrics_by_date').on(t.date),
  })
)

// --- funnels / cohorts -----------------------------------------------------

export const funnelDefinitions = sqliteTable('funnel_definitions', {
  funnelId: text('funnel_id').primaryKey(),
  name: text('name').notNull(),
  steps: text('steps').notNull(),
  windowHours: integer('window_hours').notNull(),
  scope: text('scope').$type<FunnelScope>().notNull(),
  owner: text('owner').notNull(),
  version: integer('version').notNull().default(1),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const funnelResultsDaily = sqliteTable(
  'funnel_results_daily',
  {
    funnelId: text('funnel_id').notNull(),
    cohortDate: integer('cohort_date').notNull(),
    stepIndex: integer('step_index').notNull(),
    dims: text('dims').notNull().default('{}'),
    entered: integer('entered').notNull().default(0),
    completed: integer('completed').notNull().default(0),
    conversionPct: real('conversion_pct').notNull().default(0),
    medianHoursToStep: real('median_hours_to_step').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({
      columns: [t.funnelId, t.cohortDate, t.stepIndex, t.dims],
    }),
    byFunnel: index('funnel_results_by_funnel').on(t.funnelId),
  })
)

export const cohortRetentionMonthly = sqliteTable(
  'cohort_retention_monthly',
  {
    cohortMonth: integer('cohort_month').notNull(),
    monthN: integer('month_n').notNull(),
    segment: text('segment').notNull().default('all'),
    accountsStart: integer('accounts_start').notNull().default(0),
    accountsRetained: integer('accounts_retained').notNull().default(0),
    grrPct: real('grr_pct').notNull().default(0),
    nrrPct: real('nrr_pct').notNull().default(0),
    mrrStartUsdCents: integer('mrr_start_usd_cents').notNull().default(0),
    mrrRetainedUsdCents: integer('mrr_retained_usd_cents').notNull().default(0),
    mrrExpansionUsdCents: integer('mrr_expansion_usd_cents').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.cohortMonth, t.monthN, t.segment] }),
  })
)

// --- inputs & references ---------------------------------------------------

export const channelSpend = sqliteTable(
  'channel_spend',
  {
    month: text('month').notNull(),
    channel: text('channel').$type<ChannelClass>().notNull(),
    spendUsdCents: integer('spend_usd_cents').notNull().default(0),
    source: text('source').$type<ChannelSpendSource>().notNull().default('csv_import'),
    importedBy: text('imported_by').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.month, t.channel] }),
  })
)

export const modelPrices = sqliteTable(
  'model_prices',
  {
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    validFrom: integer('valid_from', { mode: 'timestamp_ms' }).notNull(),
    inputPricePerMtokUsdMicrocents: integer('input_price_per_mtok_usd_microcents')
      .notNull()
      .default(0),
    outputPricePerMtokUsdMicrocents: integer(
      'output_price_per_mtok_usd_microcents'
    )
      .notNull()
      .default(0),
    version: integer('version').notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.model, t.validFrom] }),
  })
)

export const fxRates = sqliteTable(
  'fx_rates',
  {
    date: integer('date').notNull(),
    currency: text('currency').notNull(),
    usdRate: real('usd_rate').notNull().default(1),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.date, t.currency] }),
  })
)

export const companyInputsQuarterly = sqliteTable('company_inputs_quarterly', {
  quarter: text('quarter').primaryKey(),
  smExpenseUsdCents: integer('sm_expense_usd_cents').notNull().default(0),
  grossMarginPct: real('gross_margin_pct').notNull().default(0),
  fcfMarginPct: real('fcf_margin_pct').notNull().default(0),
  enteredBy: text('entered_by').notNull(),
  enteredAt: integer('entered_at', { mode: 'timestamp_ms' }).notNull(),
})

export const providerInvoices = sqliteTable(
  'provider_invoices',
  {
    provider: text('provider').notNull(),
    month: text('month').notNull(),
    amountUsdCents: integer('amount_usd_cents').notNull().default(0),
    enteredBy: text('entered_by').notNull(),
    enteredAt: integer('entered_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.month] }),
  })
)

export const opsSettings = sqliteTable('ops_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedBy: text('updated_by').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

// --- alerts / flags / admin -----------------------------------------------

export const alerts = sqliteTable(
  'alerts',
  {
    id: text('id').primaryKey(),
    metricKey: text('metric_key').notNull(),
    dims: text('dims').notNull().default('{}'),
    severity: text('severity').$type<AlertSeverity>().notNull(),
    zScore: real('z_score'),
    threshold: real('threshold'),
    status: text('status').$type<AlertStatus>().notNull(),
    firedAt: integer('fired_at', { mode: 'timestamp_ms' }).notNull(),
    ackedAt: integer('acked_at', { mode: 'timestamp_ms' }),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
    ownerRole: text('owner_role').$type<Role>().notNull(),
    slackTs: text('slack_ts'),
  },
  (t) => ({
    byStatus: index('alerts_by_status').on(t.status),
    byMetric: index('alerts_by_metric').on(t.metricKey),
  })
)

export const featureFlagMirror = sqliteTable('feature_flag_mirror', {
  flagKey: text('flag_key').primaryKey(),
  description: text('description').notNull().default(''),
  state: text('state').notNull().default('{}'),
  lastChangedBy: text('last_changed_by').notNull(),
  lastChangedAt: integer('last_changed_at', { mode: 'timestamp_ms' }).notNull(),
  lastChangeReason: text('last_change_reason').notNull().default(''),
})

export const adminActions = sqliteTable(
  'admin_actions',
  {
    id: text('id').primaryKey(),
    type: text('type').$type<AdminActionType>().notNull(),
    status: text('status').$type<AdminActionStatus>().notNull(),
    requestedBy: text('requested_by').notNull(),
    approvedBy: text('approved_by'),
    targetAccountId: text('target_account_id'),
    params: text('params').notNull().default('{}'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    productApiResponse: text('product_api_response'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    byType: index('admin_actions_by_type').on(t.type),
    byStatus: index('admin_actions_by_status').on(t.status),
    byTarget: index('admin_actions_by_target').on(t.targetAccountId),
  })
)

// --- audit log -------------------------------------------------------------

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: integer('at', { mode: 'timestamp_ms' }).notNull(),
    actorStaffId: text('actor_staff_id').notNull(),
    actorRole: text('actor_role').$type<Role>().notNull(),
    action: text('action').notNull(),
    objectType: text('object_type').notNull(),
    objectId: text('object_id').notNull(),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    reason: text('reason').notNull().default(''),
    ip: text('ip').notNull().default(''),
    userAgent: text('user_agent').notNull().default(''),
    prevHash: text('prev_hash').notNull().default(''),
    hash: text('hash').notNull().default(''),
  },
  (t) => ({
    byActor: index('audit_by_actor').on(t.actorStaffId),
    byAction: index('audit_by_action').on(t.action),
    byObject: index('audit_by_object').on(t.objectType, t.objectId),
    byTime: index('audit_by_time').on(t.at),
  })
)

// --- governance / ops infra -----------------------------------------------

export const gdprRequests = sqliteTable(
  'gdpr_requests',
  {
    id: text('id').primaryKey(),
    type: text('type').$type<GdprType>().notNull(),
    accountId: text('account_id'),
    userId: text('user_id'),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
    deadlineAt: integer('deadline_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status').$type<GdprStatus>().notNull(),
    steps: text('steps').notNull().default('[]'),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    byStatus: index('gdpr_by_status').on(t.status),
  })
)

export const syncWatermarks = sqliteTable('sync_watermarks', {
  source: text('source').primaryKey(),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }).notNull(),
  lastId: text('last_id'),
  rowsLastRun: integer('rows_last_run').notNull().default(0),
  lagSeconds: integer('lag_seconds').notNull().default(0),
})

export const ingestDeadLetter = sqliteTable('ingest_dead_letter', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  payload: text('payload').notNull(),
  error: text('error').notNull(),
  receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
  replayedAt: integer('replayed_at', { mode: 'timestamp_ms' }),
})

export const reconciliationIssues = sqliteTable(
  'reconciliation_issues',
  {
    id: text('id').primaryKey(),
    date: integer('date').notNull(),
    domain: text('domain').$type<ReconciliationDomain>().notNull(),
    accountId: text('account_id'),
    expectedUsdCents: integer('expected_usd_cents').notNull().default(0),
    actualUsdCents: integer('actual_usd_cents').notNull().default(0),
    deltaUsdCents: integer('delta_usd_cents').notNull().default(0),
    status: text('status').$type<ReconciliationStatus>().notNull(),
    openedAt: integer('opened_at', { mode: 'timestamp_ms' }).notNull(),
    resolvedAt: integer('resolved_at', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    byStatus: index('recon_by_status').on(t.status),
  })
)

export const scraperHealthStates = sqliteTable('scraper_health_states', {
  engine: text('engine').$type<EngineKey>().primaryKey(),
  state: text('state').$type<ScraperHealthState>().notNull(),
  detectorContext: text('detector_context').notNull().default(''),
  changedAt: integer('changed_at', { mode: 'timestamp_ms' }).notNull(),
})
