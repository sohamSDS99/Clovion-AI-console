'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { FreshnessStrip, type FreshnessRow } from './FreshnessStrip'

export type TopbarUser = {
  name: string
  email: string
  role: string
  initials: string
}

export type TopbarProps = {
  user: TopbarUser
  freshness?: FreshnessRow[]
  className?: string
}

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

function nowUtcHHMMSS(): string {
  const d = new Date()
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export function Topbar({ user, freshness = [], className }: TopbarProps) {
  const [clock, setClock] = useState<string>('--:--:--')
  const [menuOpen, setMenuOpen] = useState(false)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    setClock(nowUtcHHMMSS())
    const id = window.setInterval(() => {
      if (mounted.current) setClock(nowUtcHHMMSS())
    }, 1000)
    return () => {
      mounted.current = false
      window.clearInterval(id)
    }
  }, [])

  function openSearch() {
    // Search palette wired in later phase; emit a global event so cmdk can subscribe.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clovion:search-open'))
    }
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-[200px] h-[40px] bg-paper border-b border-black/15 flex items-center justify-between px-3 z-20',
        className,
      )}
    >
      {/* Left: search */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={openSearch}
          className="flex items-center gap-2 border border-black/15 px-2 h-6 text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/70"
          aria-label="Open search"
        >
          <span>SEARCH</span>
          <span className="inline-flex items-center justify-center min-w-[28px] h-[14px] px-1 border border-black/30 text-[9.5px] font-mono leading-none">
            {'⌘K'}
          </span>
        </button>
      </div>

      {/* Right: clock + freshness + user */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums">
          <span className="text-black/40 uppercase tracking-[0.12em]">UTC</span>
          <span className="text-black">{clock}</span>
        </div>

        <div className="h-4 w-px bg-black/15" aria-hidden="true" />

        <FreshnessStrip rows={freshness} />

        <div className="h-4 w-px bg-black/15" aria-hidden="true" />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 border border-black/15 px-1.5 h-6"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="w-4 h-4 bg-black text-white text-[9px] font-mono flex items-center justify-center uppercase">
              {user.initials.slice(0, 2)}
            </span>
            <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/70">
              {user.role}
            </span>
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[28px] min-w-[200px] bg-paper border border-black/20"
            >
              <div className="px-3 py-2 border-b border-black/10">
                <div className="text-[10px] font-mono">{user.email}</div>
                <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-black/55 mt-0.5">
                  {user.role}
                </div>
              </div>
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="w-full text-left px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.12em] text-black/80 hover:bg-black/5"
                >
                  SIGN OUT
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}

export default Topbar
