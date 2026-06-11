import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  staffUsers,
  opsSettings,
  companyInputsQuarterly,
  providerInvoices,
  channelSpend,
  syncWatermarks,
} from '@/lib/db/schema'
import { METRICS } from '@/lib/admin/metrics'

export type SettingsData = {
  staff: Array<{
    id: string
    email: string
    name: string
    role: string
    active: boolean
    lastLoginAt: number | null
  }>
  opsSettings: Array<{ key: string; value: unknown; updatedBy: string; updatedAt: number }>
  companyInputs: Array<{
    quarter: string
    smExpenseUsdCents: number
    grossMarginPct: number
    fcfMarginPct: number
    enteredBy: string
    enteredAt: number
  }>
  providerInvoices: Array<{
    provider: string
    month: string
    amountUsdCents: number
    enteredBy: string
  }>
  channelSpend: Array<{
    month: string
    channel: string
    spendUsdCents: number
    source: string
  }>
  integrationsHealth: Array<{
    source: string
    lastSyncedAt: number
    lagSeconds: number
    rowsLastRun: number
  }>
  metricsCatalog: typeof METRICS
}

export async function loadSettings(): Promise<SettingsData> {
  const staff = db
    .select()
    .from(staffUsers)
    .orderBy(asc(staffUsers.email))
    .all()
    .map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      role: s.role,
      active: s.active,
      lastLoginAt: s.lastLoginAt?.getTime() ?? null,
    }))

  const settings = db
    .select()
    .from(opsSettings)
    .orderBy(asc(opsSettings.key))
    .all()
    .map((s) => ({
      key: s.key,
      value: JSON.parse(s.value),
      updatedBy: s.updatedBy,
      updatedAt: s.updatedAt.getTime(),
    }))

  const companyInputs = db
    .select()
    .from(companyInputsQuarterly)
    .orderBy(desc(companyInputsQuarterly.quarter))
    .all()
    .map((c) => ({
      quarter: c.quarter,
      smExpenseUsdCents: c.smExpenseUsdCents,
      grossMarginPct: c.grossMarginPct,
      fcfMarginPct: c.fcfMarginPct,
      enteredBy: c.enteredBy,
      enteredAt: c.enteredAt.getTime(),
    }))

  const pInvoices = db
    .select()
    .from(providerInvoices)
    .orderBy(desc(providerInvoices.month))
    .all()
    .map((p) => ({
      provider: p.provider,
      month: p.month,
      amountUsdCents: p.amountUsdCents,
      enteredBy: p.enteredBy,
    }))

  const channels = db
    .select()
    .from(channelSpend)
    .orderBy(desc(channelSpend.month))
    .all()
    .map((c) => ({
      month: c.month,
      channel: c.channel,
      spendUsdCents: c.spendUsdCents,
      source: c.source,
    }))

  const integrations = db
    .select()
    .from(syncWatermarks)
    .all()
    .map((w) => ({
      source: w.source,
      lastSyncedAt: w.lastSyncedAt.getTime(),
      lagSeconds: w.lagSeconds,
      rowsLastRun: w.rowsLastRun,
    }))

  return {
    staff,
    opsSettings: settings,
    companyInputs,
    providerInvoices: pInvoices,
    channelSpend: channels,
    integrationsHealth: integrations,
    metricsCatalog: METRICS,
  }
}
