import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type PageHeaderProps = {
  section: string
  label: string
  meta?: string
  right?: ReactNode
  className?: string
}

export function PageHeader({ section, label, meta, right, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-end justify-between gap-4 border-b border-black/15 pb-2.5 mb-4',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-[9.5px] uppercase tracking-[0.16em] text-black/50 font-mono">
          {section}
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight leading-tight truncate">
          {label}
        </h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {meta ? (
          <div className="text-[11px] font-mono tabular-nums text-black/45 uppercase tracking-[0.08em]">
            {meta}
          </div>
        ) : null}
        {right}
      </div>
    </div>
  )
}

export default PageHeader
