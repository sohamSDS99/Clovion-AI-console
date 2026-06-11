import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type PanelProps = {
  title: string
  meta?: string
  right?: ReactNode
  children?: ReactNode
  padding?: 'none' | 'normal'
  className?: string
  bodyClassName?: string
}

export function Panel({
  title,
  meta,
  right,
  children,
  padding = 'normal',
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section className={cn('border border-black/15 bg-paper', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-2">
        <div className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-black/80">
          {title}
        </div>
        <div className="flex items-center gap-3">
          {meta ? (
            <span className="text-[9.5px] font-mono tabular-nums uppercase tracking-[0.08em] text-black/40">
              {meta}
            </span>
          ) : null}
          {right}
        </div>
      </header>
      <div className={cn(padding === 'normal' ? 'p-3' : '', bodyClassName)}>{children}</div>
    </section>
  )
}

export default Panel
