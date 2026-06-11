// Shared string-literal union types referenced across schema and queries.
// Single source of truth — schema.ts uses $type<>() generics from this file.

export type Role = 'owner' | 'admin' | 'analyst' | 'support' | 'engineer'

export type AccountType = 'brand' | 'agency'
export type PlanTier = 'free' | 'starter' | 'growth' | 'enterprise'
export type AccountStatus = 'active' | 'churned' | 'trialing'

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'unpaid'
export type SubscriptionInterval = 'month' | 'year'

export type EngineKey =
  | 'chatgpt'
  | 'perplexity'
  | 'gemini'
  | 'google_aio'
  | 'google_ai_mode'
  | 'copilot'
  | 'claude'
  | 'grok'
  | 'deepseek'

export type FeatureKey =
  | 'dashboards'
  | 'reports'
  | 'exports'
  | 'alerts'
  | 'api'
  | 'mcp'
  | 'sentiment_view'
  | 'citations_view'
  | 'competitor_view'
  | 'settings'

export type LedgerFeature =
  | 'prompt_run'
  | 'sentiment'
  | 'citation_extract'
  | 'report_generate'
  | 'recommendation'
  | 'other'

export type ChannelClass =
  | 'organic_search'
  | 'paid_search'
  | 'paid_social'
  | 'organic_social'
  | 'referral'
  | 'direct'
  | 'email'
  | 'ai_assistant'
  | 'unknown'

export type ReasonCode =
  | 'too_expensive'
  | 'missing_engine'
  | 'missing_feature'
  | 'not_enough_value'
  | 'switched_competitor'
  | 'project_ended'
  | 'downgrade_free'
  | 'other'

export type EventSource = 'web' | 'server' | 'pipeline' | 'billing'
export type IngestLane = 'posthog' | 'direct'

export type PipelineStatus = 'success' | 'failed' | 'skipped'
export type FailureClass =
  | 'scrape_block'
  | 'auth'
  | 'rate_limit'
  | 'parse'
  | 'llm_error'
  | 'timeout'
  | 'infra'
export type SkipCause = 'quota' | 'kill_switch'

export type CostSource = 'ingested' | 'inferred'

export type SubEventType =
  | 'new'
  | 'expansion'
  | 'contraction'
  | 'churn'
  | 'reactivation'
  | 'trial_started'
  | 'trial_converted'
  | 'discount_change'
export type SubEventSource = 'snapshot_diff' | 'webhook'

export type InvoiceStatus = 'open' | 'paid' | 'void' | 'uncollectible'

export type TicketStatus = 'open' | 'pending' | 'solved' | 'closed'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

export type FunnelScope = 'user' | 'account'

export type AlertSeverity = 'info' | 'warn' | 'critical'
export type AlertStatus = 'open' | 'acked' | 'resolved'

export type AdminActionType =
  | 'impersonation'
  | 'plan_override'
  | 'refund'
  | 'credit'
  | 'kill_switch'
  | 'flag_change'
  | 'gdpr'
export type AdminActionStatus =
  | 'requested'
  | 'approved'
  | 'executed'
  | 'failed'
  | 'expired'

export type GdprType = 'delete' | 'export'
export type GdprStatus = 'open' | 'in_progress' | 'completed' | 'breached'

export type ReconciliationDomain = 'stripe_mrr' | 'provider_invoice'
export type ReconciliationStatus = 'open' | 'resolved'

export type ScraperHealthState = 'green' | 'amber' | 'red'

export type ChannelSpendSource = 'csv_import' | 'manual'

export type MetricGrain =
  | 'realtime'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'cohort'
export type MetricUnit =
  | 'pct'
  | 'cents'
  | 'microcents'
  | 'count'
  | 'ratio'
  | 'ms'
  | 'duration_h'
  | 'score'
