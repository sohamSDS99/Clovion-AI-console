import 'server-only'
import type { Role } from '@/lib/db/types'

// Role-permission matrix per PRD §4.7. Boolean only; server-side decisions live here.
export type Permission =
  | 'dashboard.view'
  | 'account.view'
  | 'account.search'
  | 'pii.reveal'
  | 'csv.export'
  | 'plan.override'
  | 'refund.issue'
  | 'credit.issue'
  | 'flag.toggle'
  | 'kill_switch.toggle'
  | 'impersonation.request'
  | 'impersonation.approve'
  | 'gdpr.process'
  | 'staff.manage'
  | 'audit.view'
  | 'audit.verify_chain'
  | 'settings.write'
  | 'alerts.ack'

type Matrix = Record<Role, Record<Permission, boolean>>

const allow = (...perms: Permission[]): Record<Permission, boolean> => {
  const out: Record<string, boolean> = {}
  const all: Permission[] = [
    'dashboard.view',
    'account.view',
    'account.search',
    'pii.reveal',
    'csv.export',
    'plan.override',
    'refund.issue',
    'credit.issue',
    'flag.toggle',
    'kill_switch.toggle',
    'impersonation.request',
    'impersonation.approve',
    'gdpr.process',
    'staff.manage',
    'audit.view',
    'audit.verify_chain',
    'settings.write',
    'alerts.ack',
  ]
  for (const p of all) out[p] = false
  for (const p of perms) out[p] = true
  return out as Record<Permission, boolean>
}

export const PERMISSIONS: Matrix = {
  owner: allow(
    'dashboard.view',
    'account.view',
    'account.search',
    'pii.reveal',
    'csv.export',
    'plan.override',
    'refund.issue',
    'credit.issue',
    'flag.toggle',
    'kill_switch.toggle',
    'impersonation.request',
    'impersonation.approve',
    'gdpr.process',
    'staff.manage',
    'audit.view',
    'audit.verify_chain',
    'settings.write',
    'alerts.ack'
  ),
  admin: allow(
    'dashboard.view',
    'account.view',
    'account.search',
    'pii.reveal',
    'csv.export',
    'plan.override',
    'refund.issue',
    'credit.issue',
    'flag.toggle',
    'kill_switch.toggle',
    'impersonation.request',
    'impersonation.approve',
    'gdpr.process',
    'audit.view',
    'settings.write',
    'alerts.ack'
  ),
  analyst: allow(
    'dashboard.view',
    'account.view',
    'account.search',
    'csv.export',
    'audit.view'
  ),
  support: allow(
    'dashboard.view',
    'account.view',
    'account.search',
    'pii.reveal',
    'impersonation.request',
    'alerts.ack'
  ),
  engineer: allow(
    'dashboard.view',
    'account.view',
    'account.search',
    'kill_switch.toggle',
    'flag.toggle',
    'audit.view',
    'alerts.ack'
  ),
}

export function can(role: Role, perm: Permission): boolean {
  return PERMISSIONS[role]?.[perm] === true
}

export function requirePermission(role: Role, perm: Permission): void {
  if (!can(role, perm)) {
    throw new Error(`Forbidden: role '${role}' lacks '${perm}'`)
  }
}
