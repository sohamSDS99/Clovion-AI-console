'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ChartTooltip, type TooltipRow } from './charts/ChartTooltip'
import { useTooltip } from './charts/useTooltip'

export type BarRow = {
  label: string
  value: number
  /** Optional override max for normalization. */
  max?: number
  /** Optional display string (else the value is rendered). */
  display?: string
}

export type BarsProps = {
  rows: BarRow[]
  height?: number
  labelWidth?: number
  className?: string
  /** Default formatter for the value when row.display is absent. */
  format?: (v: number) => string
}

function pct(t: number): string {
  const v = Math.max(0, Math.min(1, t))
  return `${Math.round(v * 100)}%`
}

export function Bars({
  rows,
  height = 20,
  labelWidth = 80,
  className,
  format = (v) => v.toLocaleString('en-US'),
}: BarsProps) {
  const explicitMax = rows.reduce((m, r) => Math.max(m, r.max ?? 0), 0)
  const valuesMax = rows.reduce((m, r) => Math.max(m, r.value), 0)
  const max = explicitMax > 0 ? explicitMax : valuesMax || 1

  const { state, show, move, hide } = useTooltip()
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className={cn('flex flex-col', className)} style={{ rowGap: 2 }}>
      {rows.map((r, i) => {
        const pctVal = Math.max(0, Math.min(1, r.value / max))
        const isHovered = hovered === i
        // Bar fill is solid black — use white inset highlight.
        const outline = isHovered
          ? 'inset 0 0 0 1.5px rgba(255,255,255,1)'
          : undefined
        return (
          <div
            key={`${r.label}-${i}`}
            className="grid items-center gap-2"
            style={{
              gridTemplateColumns: `${labelWidth}px 1fr auto`,
              height,
              cursor: 'default',
            }}
            onPointerEnter={(e) => {
              setHovered(i)
              const tooltipRows: TooltipRow[] = [
                { label: 'VALUE', value: r.value.toLocaleString() },
              ]
              if (r.max) {
                tooltipRows.push({
                  label: 'OF',
                  value: r.max.toLocaleString(),
                })
                tooltipRows.push({
                  label: '%',
                  value: pct(r.value / r.max),
                })
              }
              show(e, r.label, tooltipRows)
            }}
            onPointerMove={(e) => move(e)}
            onPointerLeave={() => {
              setHovered(null)
              hide()
            }}
          >
            <span className="text-[10px] font-mono tabular-nums uppercase tracking-[0.08em] text-black/60 truncate">
              {r.label}
            </span>
            <div
              className="relative bg-black/5"
              style={{ height: Math.max(2, Math.floor(height / 2.5)) }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-black"
                style={{
                  width: `${(pctVal * 100).toFixed(2)}%`,
                  boxShadow: outline,
                }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-black/80 text-right">
              {r.display ?? format(r.value)}
            </span>
          </div>
        )
      })}
      <ChartTooltip state={state} />
    </div>
  )
}

export default Bars
