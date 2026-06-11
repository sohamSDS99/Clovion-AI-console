import type { ReactNode } from 'react'
import { requireSession } from '@/lib/admin/session'
import { Sidebar } from '@/components/admin/Sidebar'
import { Topbar } from '@/components/admin/Topbar'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession()
  const u = {
    name: user.name,
    email: user.email,
    role: user.role,
    initials: user.initials,
  }

  return (
    <div className="admin-root min-h-screen bg-paper text-ink">
      <Sidebar user={u} />
      <Topbar user={u} freshness={[]} />
      <main className="pl-[200px] pt-[40px] min-h-screen">
        <div className="p-4">{children}</div>
      </main>
    </div>
  )
}
