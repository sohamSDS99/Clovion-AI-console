'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

export type Tab = { code: string; label: string; href: string }

export function TabStrip({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname() || ''
  return (
    <div className="flex items-stretch border-b border-black/15 -mt-4 -mx-4 mb-4 px-4 bg-paper">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/')
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'px-3 h-9 inline-flex items-center text-[11px] uppercase tracking-[0.12em] border-b-2 -mb-px',
              active
                ? 'border-black opacity-100 font-semibold'
                : 'border-transparent opacity-50 hover:opacity-80',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}

export default TabStrip
