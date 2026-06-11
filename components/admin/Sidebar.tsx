'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { sidebar } from '@/lib/admin/nav'
import { cn } from '@/lib/cn'

export type SidebarUser = {
  name: string
  email: string
  role: string
  initials: string
}

export type SidebarProps = {
  user: SidebarUser
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname() || '/'

  return (
    <aside
      className="fixed top-0 left-0 h-screen w-[200px] bg-black text-white flex flex-col z-30"
      aria-label="Primary"
    >
      {/* Wordmark */}
      <div className="px-3 py-3 border-b border-white/15">
        <div className="font-mono uppercase tracking-[0.16em] text-[11px] leading-none">
          <span>CLOVION</span>
          <span className="text-white/40 px-1">/</span>
          <span>CONSOLE</span>
        </div>
        <div className="mt-1 text-[8.5px] font-mono uppercase tracking-[0.18em] text-white/35">
          INTERNAL
        </div>
      </div>

      {/* Nav — 6 flat categories */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        <ul>
          {sidebar.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <li key={`${item.href}-${item.n}`} className="relative">
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-white"
                  />
                ) : null}
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 pl-3 pr-3 text-[12px] leading-none',
                    active ? 'bg-white/10 text-white' : 'text-white/70',
                  )}
                  style={{ height: 34 }}
                >
                  <span className="text-white/35 font-mono text-[10px] tabular-nums w-4">
                    {String(item.n).padStart(2, '0')}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/15 px-3 py-2 flex items-center gap-2">
        <div
          className="w-7 h-7 border border-white/40 flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.06em]"
          aria-hidden="true"
        >
          {user.initials.slice(0, 2)}
        </div>
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="text-[10px] font-mono text-white truncate">{user.email}</span>
          <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/55">
            {user.role}
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
