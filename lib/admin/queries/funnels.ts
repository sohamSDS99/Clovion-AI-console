import 'server-only'
import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { funnelDefinitions, funnelResultsDaily } from '@/lib/db/schema'

export type FunnelDefRow = {
  funnelId: string
  name: string
  steps: string[]
  windowHours: number
  scope: 'user' | 'account'
  active: boolean
  version: number
}

export type FunnelStepRow = {
  stepIndex: number
  step: string
  entered: number
  completed: number
  conversionPct: number
}

export type FunnelDetail = FunnelDefRow & {
  stepResults: FunnelStepRow[]
}

export async function loadFunnelList(): Promise<FunnelDefRow[]> {
  return db
    .select()
    .from(funnelDefinitions)
    .orderBy(asc(funnelDefinitions.funnelId))
    .all()
    .map((d) => ({
      funnelId: d.funnelId,
      name: d.name,
      steps: JSON.parse(d.steps),
      windowHours: d.windowHours,
      scope: d.scope,
      active: d.active,
      version: d.version,
    }))
}

export async function loadFunnel(funnelId: string): Promise<FunnelDetail | null> {
  const def = db
    .select()
    .from(funnelDefinitions)
    .where(eq(funnelDefinitions.funnelId, funnelId))
    .limit(1)
    .all()[0]
  if (!def) return null
  const steps = JSON.parse(def.steps) as string[]
  const rows = db
    .select()
    .from(funnelResultsDaily)
    .where(eq(funnelResultsDaily.funnelId, funnelId))
    .all()
  const stepResults: FunnelStepRow[] = steps.map((step, i) => {
    const stepRows = rows.filter((r) => r.stepIndex === i)
    const entered = stepRows.reduce((s, r) => s + r.entered, 0)
    const completed = stepRows.reduce((s, r) => s + r.completed, 0)
    return {
      stepIndex: i,
      step,
      entered,
      completed,
      conversionPct: entered ? completed / entered : 0,
    }
  })
  return {
    funnelId: def.funnelId,
    name: def.name,
    steps,
    windowHours: def.windowHours,
    scope: def.scope,
    active: def.active,
    version: def.version,
    stepResults,
  }
}
