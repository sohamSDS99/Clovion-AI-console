import 'server-only'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { featureFlagMirror, auditLog } from '@/lib/db/schema'

export type FlagRow = {
  flagKey: string
  description: string
  enabled: boolean
  rollout: number
  lastChangedBy: string
  lastChangedAt: number
  lastChangeReason: string
}

export type FlagsData = {
  flags: FlagRow[]
  history: Array<{
    id: number
    action: string
    actorStaffId: string
    objectId: string
    at: number
  }>
}

export async function loadFlags(): Promise<FlagsData> {
  const flags = db
    .select()
    .from(featureFlagMirror)
    .orderBy(asc(featureFlagMirror.flagKey))
    .all()
    .map((f) => {
      const state = f.state ? JSON.parse(f.state) : {}
      return {
        flagKey: f.flagKey,
        description: f.description,
        enabled: Boolean(state.enabled),
        rollout: Number(state.rollout ?? 0),
        lastChangedBy: f.lastChangedBy,
        lastChangedAt: f.lastChangedAt.getTime(),
        lastChangeReason: f.lastChangeReason,
      }
    })

  const history = db
    .select()
    .from(auditLog)
    .where(eq(auditLog.action, 'flag_change'))
    .orderBy(desc(auditLog.at))
    .limit(50)
    .all()
    .map((a) => ({
      id: a.id,
      action: a.action,
      actorStaffId: a.actorStaffId,
      objectId: a.objectId,
      at: a.at.getTime(),
    }))

  return { flags, history }
}
