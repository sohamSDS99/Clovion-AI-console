import type { MetricUnit, MetricGrain, Role } from '@/lib/db/types'

export type Benchmark = {
  value: number
  label: string
  source: string
  vintage: string
  confidence?: 'high' | 'medium' | 'low'
}

export type MetricDef = {
  key: string
  owner: Role
  unit: MetricUnit
  grain: MetricGrain
  description: string
  version: number
  domain:
    | 'acquisition'
    | 'activation'
    | 'engagement'
    | 'retention'
    | 'revenue'
    | 'performance'
    | 'pipeline'
    | 'support'
    | 'governance'
  benchmark?: Benchmark
  anchor?: boolean
}

import { ACQUISITION_METRICS } from './acquisition'
import { ACTIVATION_METRICS } from './activation'
import { ENGAGEMENT_METRICS } from './engagement'
import { RETENTION_METRICS } from './retention'
import { REVENUE_METRICS } from './revenue'
import { PERFORMANCE_METRICS } from './performance'
import { PIPELINE_METRICS } from './pipeline'
import { SUPPORT_METRICS } from './support'
import { GOVERNANCE_METRICS } from './governance'

export const METRICS: MetricDef[] = [
  ...ACQUISITION_METRICS,
  ...ACTIVATION_METRICS,
  ...ENGAGEMENT_METRICS,
  ...RETENTION_METRICS,
  ...REVENUE_METRICS,
  ...PERFORMANCE_METRICS,
  ...PIPELINE_METRICS,
  ...SUPPORT_METRICS,
  ...GOVERNANCE_METRICS,
]

const BY_KEY = new Map<string, MetricDef>(METRICS.map((m) => [m.key, m]))

export function metricByKey(key: string): MetricDef | undefined {
  return BY_KEY.get(key)
}

export function metricsByDomain(domain: MetricDef['domain']): MetricDef[] {
  return METRICS.filter((m) => m.domain === domain)
}

export const ANCHOR_KEYS = METRICS.filter((m) => m.anchor).map((m) => m.key)
