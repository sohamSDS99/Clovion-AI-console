import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { Sparkline } from './Sparkline'

export type KpiDelta = {
  pct: number
  dir: 'up' | 'down' | 'flat'
}

export type KpiCardProps = {
  label: string
  value: string
  delta?: KpiDelta
  spark?: number[]
  meta?: string
  href?: string
  className?: string
}

function DeltaGlyph({ dir }: { dir: KpiDelta['dir'] }) {
  if (dir === 'up') return <span aria-hidden="true">{'▲'}</span>
  if (dir === 'down') return <span aria-hidden="true">{'▼'}</span>
  return <span aria-hidden="true">{'▬'}</span>
}

export function KpiCard({
  label,
  value,
  delta,
  spark,
  meta,
  href,
  className,
}: KpiCardProps) {
  const body = (
    <div
      className={cn(
        'flex flex-col gap-1.5 border border-black/10 bg-paper px-3 py-2.5 min-w-0',
        href ? 'cursor-pointer' : '',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/45 truncate">
          {label}
        </span>
        {meta ? (
          <span className="text-[9.5px] font-mono tabular-nums uppercase tracking-[0.08em] text-black/35 shrink-0">
            {meta}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono tabular-nums text-[20px] font-semibold leading-none truncate">
          {value}
        </span>
        {spark && spark.length > 0 ? (
          <Sparkline values={spark} width={60} height={20} stroke={1.25} />
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-black/70 leading-none min-h-[12px]">
        {delta ? (
          <>
            <DeltaGlyph dir={delta.dir} />
            <span>
              {delta.dir === 'flat'
                ? '0.0%'
                : `${delta.dir === 'down' ? '-' : '+'}${Math.abs(delta.pct).toFixed(1)}%`}
            </span>
          </>
        ) : (
          <span className="text-black/30">{'—'}</span>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    )
  }
  return body
}

export type KpiGridProps = {
  cols?: 4 | 6 | 8
  children: ReactNode
  className?: string
}

const COL_MAP: Record<NonNullable<KpiGridProps['cols']>, string> = {
  4: 'lg:grid-cols-4',
  6: 'lg:grid-cols-6',
  8: 'lg:grid-cols-8',
}

export function KpiGrid({ cols = 4, children, className }: KpiGridProps) {
  return (
    <div className={cn('border border-black/15 bg-black/5', className)}>
      <div
        className={cn(
          'grid grid-cols-2 md:grid-cols-3 gap-px bg-black/15',
          COL_MAP[cols],
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default KpiCard
