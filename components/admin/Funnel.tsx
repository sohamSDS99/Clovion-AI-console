'use client'

import { cn } from '@/lib/cn'
import { ChartTooltip } from '@/components/admin/charts/ChartTooltip'
import { useTooltip } from '@/components/admin/charts/useTooltip'
import { useState } from 'react'
import { paletteAt } from '@/lib/admin/palette'

export type FunnelStep = {
  name: string
  entered: number
  completed: number
  conversionPct?: number
  medianHoursToStep?: number
}

export type FunnelProps = {
  steps: FunnelStep[]
  className?: string
  labelWidth?: number
  /** Single uniform bar fill (legacy). Used when `colors` is not provided. */
  color?: string
  /** Explicit per-step color array. Cycled with `colors[i % colors.length]`. Highest priority. */
  colors?: string[]
}

function pct(n: number) {
  if (!Number.isFinite(n)) return '0%'
  return `${(n * 100).toFixed(1)}%`
}

type Row = { label: string; value: string }

export function Funnel({
  steps,
  className,
  labelWidth = 200,
  color,
  colors,
}: FunnelProps) {
  const { state, show, move, hide } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (steps.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }
  const first = steps[0].entered || 1

  // Resolve per-step fill color. Priority:
  //   1) explicit `colors[]` per-step array
  //   2) uniform `color` prop (legacy)
  //   3) auto-cycle palette
  const resolveColor = (i: number): string => {
    if (colors && colors.length > 0) return colors[i % colors.length]
    if (color) return color
    return paletteAt(i)
  }

  return (
    <div className={cn('flex flex-col', className)} style={{ rowGap: 4 }}>
      {steps.map((s, i) => {
        const widthPct = Math.max(0, Math.min(1, s.entered / first))
        const conv = s.conversionPct ?? (s.entered > 0 ? (s.completed / s.entered) * 100 : 0)
        const isHovered = hoverIdx === i
        const fill = resolveColor(i)
        const rows: Row[] = [
          { label: 'ENTERED', value: s.entered.toLocaleString('en-US') },
          { label: 'COMPLETED', value: s.completed.toLocaleString('en-US') },
          {
            label: 'CONVERSION',
            value: s.entered > 0 ? pct(s.completed / s.entered) : '0%',
          },
        ]
        if (typeof s.medianHoursToStep === 'number') {
          rows.push({ label: 'MEDIAN TIME', value: `${s.medianHoursToStep}h` })
        }
        return (
          <div
            key={`${s.name}-${i}`}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: `${labelWidth}px 1fr auto`, minHeight: 22 }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9.5px] font-mono tabular-nums text-black/40 w-5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] truncate">
                {s.name}
              </span>
            </div>
            <div
              className="relative bg-black/5"
              style={{
                height: 16,
                cursor: 'pointer',
                outline: isHovered ? '1.5px solid rgba(0,0,0,0.8)' : 'none',
                outlineOffset: 0,
              }}
              onPointerEnter={(e) => {
                setHoverIdx(i)
                show(e, s.name, rows)
              }}
              onPointerMove={(e) => move(e)}
              onPointerLeave={() => {
                setHoverIdx((curr) => (curr === i ? null : curr))
                hide()
              }}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${(widthPct * 100).toFixed(2)}%`,
                  boxShadow: isHovered ? 'inset 0 0 0 1.5px #fff' : 'none',
                  background: fill,
                }}
              />
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums shrink-0">
              <span className="text-black/70">
                {s.entered.toLocaleString('en-US')}
                <span className="text-black/30 px-1">{'→'}</span>
                {s.completed.toLocaleString('en-US')}
              </span>
              <span className="text-black/90 w-12 text-right">{conv.toFixed(1)}%</span>
              {typeof s.medianHoursToStep === 'number' ? (
                <span className="text-black/40 w-14 text-right">
                  {s.medianHoursToStep.toFixed(1)}h
                </span>
              ) : null}
            </div>
          </div>
        )
      })}

      <ChartTooltip state={state} />
    </div>
  )
}

export default Funnel
