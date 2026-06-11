import 'server-only'
import { db } from '@/lib/db'
import { syncWatermarks } from '@/lib/db/schema'

export type FreshnessRow = {
  source: string
  lagSeconds: number
  thresholdSeconds: number
  state: 'solid' | 'half' | 'hollow'
}

const THRESHOLDS: Record<string, number> = {
  events: 2 * 3600,
  stripe: 26 * 3600,
  replica: 26 * 3600,
  posthog: 2 * 3600,
  support: 6 * 3600,
  pipeline: 1 * 3600,
}

export async function loadFreshness(): Promise<FreshnessRow[]> {
  const rows = db.select().from(syncWatermarks).all()
  return rows.map((r) => {
    const threshold = THRESHOLDS[r.source] ?? 6 * 3600
    let state: FreshnessRow['state'] = 'solid'
    if (r.lagSeconds > threshold) state = 'hollow'
    else if (r.lagSeconds > threshold * 0.5) state = 'half'
    return {
      source: r.source,
      lagSeconds: r.lagSeconds,
      thresholdSeconds: threshold,
      state,
    }
  })
}
