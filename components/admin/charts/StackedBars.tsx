'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ChartLegend } from './Legend'
import { ChartTooltip } from './ChartTooltip'
import { useTooltip } from './useTooltip'

export type StackSegment = {
  name: string
  value: number
  color: string
}

export type StackedBarRow = {
  label: string
  segments: StackSegment[]
}

export type StackedBarsProps = {
  rows: StackedBarRow[]
  max?: number
  showLegend?: boolean
  rowHeight?: number
  labelWidth?: number
  className?: string
}

export function StackedBars({
  rows,
  max,
  showLegend = true,
  rowHeight = 22,
  labelWidth = 120,
  className,
}: StackedBarsProps) {
  const { state, show, move, hide } = useTooltip()
  const [hovered, setHovered] = useState<{ r: number; s: number } | null>(null)

  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }

  const rowTotals = rows.map((r) =>
    r.segments.reduce((s, x) => s + x.value, 0),
  )
  const inferredMax = Math.max(...rowTotals, 1)
  const effectiveMax = max ?? inferredMax

  // Build a stable legend from union of segment names
  const legendMap = new Map<string, string>()
  rows.forEach((r) =>
    r.segments.forEach((s) => {
      if (!legendMap.has(s.name)) legendMap.set(s.name, s.color)
    }),
  )

  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-col" style={{ rowGap: 4 }}>
        {rows.map((r, ri) => {
          const total = rowTotals[ri]
          return (
            <div
              key={`r-${ri}`}
              className="grid items-center gap-2"
              style={{
                gridTemplateColumns: `${labelWidth}px 1fr auto`,
                height: rowHeight,
              }}
            >
              <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-black/60 truncate">
                {r.label}
              </span>
              <div
                className="flex items-stretch bg-black/5 overflow-hidden"
                style={{ height: Math.max(8, Math.floor(rowHeight / 2)) }}
              >
                {r.segments.map((seg, si) => {
                  const pct = (seg.value / Math.max(1, effectiveMax)) * 100
                  const isHovered =
                    hovered !== null && hovered.r === ri && hovered.s === si
                  const outline = isHovered
                    ? 'inset 0 0 0 1.5px rgba(255,255,255,1)'
                    : undefined
                  return (
                    <span
                      key={`seg-${ri}-${si}`}
                      title={`${seg.name}: ${seg.value.toLocaleString('en-US')}`}
                      style={{
                        width: `${pct.toFixed(2)}%`,
                        background: seg.color,
                        display: 'inline-block',
                        boxShadow: outline,
                        cursor: 'default',
                      }}
                      aria-label={`${seg.name}: ${seg.value}`}
                      onPointerEnter={(e) => {
                        setHovered({ r: ri, s: si })
                        show(
                          e,
                          r.label,
                          r.segments.map((s) => ({
                            color: s.color,
                            label: s.name ?? '—',
                            value: s.value.toLocaleString(),
                          })),
                        )
                      }}
                      onPointerMove={(e) => move(e)}
                      onPointerLeave={() => {
                        setHovered(null)
                        hide()
                      }}
                    />
                  )
                })}
              </div>
              <span className="text-[10px] font-mono tabular-nums text-black/80 text-right">
                {total.toLocaleString('en-US')}
              </span>
            </div>
          )
        })}
      </div>

      {showLegend ? (
        <ChartLegend
          className="mt-3"
          items={[...legendMap.entries()].map(([label, color]) => ({
            label,
            color,
          }))}
        />
      ) : null}
      <ChartTooltip state={state} />
    </div>
  )
}

export default StackedBars
