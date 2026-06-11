'use client'

import { cn } from '@/lib/cn'
import { ChartTooltip } from './ChartTooltip'
import { useTooltip } from './useTooltip'
import { useState } from 'react'

export type RadialItem = {
  label: string
  value: number
  max: number
  color: string
  sublabel?: string
}

export type RadialBarsProps = {
  items: RadialItem[]
  size?: number
  thickness?: number
  className?: string
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function ringArc(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg
  if (sweep <= 0) return ''
  const startOuter = polar(cx, cy, rOuter, endDeg)
  const endOuter = polar(cx, cy, rOuter, startDeg)
  const startInner = polar(cx, cy, rInner, startDeg)
  const endInner = polar(cx, cy, rInner, endDeg)
  const largeArc = sweep <= 180 ? 0 : 1
  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 1 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

function pct(n: number) {
  if (!Number.isFinite(n)) return '0%'
  return `${(n * 100).toFixed(1)}%`
}

type Row = { label: string; value: string }

export function RadialBars({
  items,
  size = 110,
  thickness = 10,
  className,
}: RadialBarsProps) {
  const { state, show, move, hide } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (items.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }

  // 270deg sweep from -135deg → +135deg
  const startDeg = -135
  const endDeg = 135
  const totalSweep = endDeg - startDeg // 270

  return (
    <div
      className={cn(
        'grid gap-3',
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((it, i) => {
        const cx = size / 2
        const cy = size / 2
        const rOuter = size / 2 - 1
        const rInner = rOuter - thickness
        const pctVal = Math.max(0, Math.min(1, it.max > 0 ? it.value / it.max : 0))
        const fgEnd = startDeg + totalSweep * pctVal
        const isHovered = hoverIdx === i

        const rows: Row[] = [
          { label: 'VALUE', value: it.value.toLocaleString('en-US') },
          { label: 'MAX', value: it.max.toLocaleString('en-US') },
          { label: '%', value: it.max > 0 ? pct(it.value / it.max) : '0%' },
        ]
        if (it.sublabel) {
          rows.push({ label: 'NOTE', value: it.sublabel })
        }

        return (
          <div key={`r-${i}`} className="flex flex-col items-center gap-1.5">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width={size}
              height={size}
              aria-hidden="true"
            >
              {/* Background track (full 270deg arc) */}
              <path
                d={ringArc(cx, cy, rOuter, rInner, startDeg, endDeg)}
                fill="rgba(0,0,0,0.08)"
              />
              {/* Foreground arc */}
              {fgEnd > startDeg + 0.01 ? (
                <path
                  d={ringArc(cx, cy, rOuter, rInner, startDeg, fgEnd)}
                  fill={it.color}
                  stroke={isHovered ? '#fff' : 'none'}
                  strokeWidth={isHovered ? 1.5 : 0}
                  style={{ cursor: 'pointer' }}
                  onPointerEnter={(e) => {
                    setHoverIdx(i)
                    show(e, it.label, rows)
                  }}
                  onPointerMove={(e) => move(e)}
                  onPointerLeave={() => {
                    setHoverIdx((curr) => (curr === i ? null : curr))
                    hide()
                  }}
                />
              ) : null}
              {/* Invisible full-ring hit area so hovering empty section also triggers */}
              <path
                d={ringArc(cx, cy, rOuter, rInner, startDeg, endDeg)}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onPointerEnter={(e) => {
                  setHoverIdx(i)
                  show(e, it.label, rows)
                }}
                onPointerMove={(e) => move(e)}
                onPointerLeave={() => {
                  setHoverIdx((curr) => (curr === i ? null : curr))
                  hide()
                }}
              />
              <text
                x={cx}
                y={cy + 5}
                textAnchor="middle"
                fontSize="16"
                fontFamily="ui-monospace, 'JetBrains Mono', monospace"
                fontWeight="600"
                fill="#000"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  pointerEvents: 'none',
                }}
              >
                {Math.round(pctVal * 100)}%
              </text>
            </svg>
            <div className="flex flex-col items-center leading-tight">
              <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/80">
                {it.label}
              </span>
              {it.sublabel ? (
                <span className="text-[9px] font-mono uppercase tracking-[0.1em] text-black/40">
                  {it.sublabel}
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

export default RadialBars
