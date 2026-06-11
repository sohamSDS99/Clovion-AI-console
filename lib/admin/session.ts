import 'server-only'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { Role } from '@/lib/db/types'

/**
 * Resolved staff session shape consumed by admin route components.
 * Initials are derived from the user's name for the sidebar/topbar avatars.
 */
export type StaffSession = {
  user: {
    id: string
    email: string
    name: string
    role: Role
    initials: string
  }
}

function deriveInitials(name: string, email: string): string {
  const src = (name || email || '').trim()
  if (!src) return '??'
  const parts = src.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return src.slice(0, 2).toUpperCase()
}

/**
 * Returns the active staff session; redirects to /login if missing.
 * Used by every server component under app/(admin).
 */
export async function requireSession(): Promise<StaffSession> {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) {
    redirect('/login')
  }
  const u = session.user
  const role = (u.role ?? 'analyst') as Role
  return {
    user: {
      id: u.id,
      email: u.email,
      name: u.name ?? u.email,
      role,
      initials: deriveInitials(u.name ?? '', u.email),
    },
  }
}

export async function getSessionOrNull(): Promise<StaffSession | null> {
  const session = await auth()
  if (!session?.user?.id || !session.user.email) return null
  const u = session.user
  const role = (u.role ?? 'analyst') as Role
  return {
    user: {
      id: u.id,
      email: u.email,
      name: u.name ?? u.email,
      role,
      initials: deriveInitials(u.name ?? '', u.email),
    },
  }
}
