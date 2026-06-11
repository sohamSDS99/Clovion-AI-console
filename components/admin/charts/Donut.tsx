'use client'

import { cn } from '@/lib/cn'
import { ChartTooltip } from './ChartTooltip'
import { useTooltip } from './useTooltip'
import { useState } from 'react'

export type DonutSlice = {
  label: string
  value: number
  color: string
}

export type DonutProps = {
  slices: DonutSlice[]
  size?: number
  thickness?: number
  centerValue?: string
  centerLabel?: string
  className?: string
  showLegend?: boolean
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const startOuter = polar(cx, cy, rOuter, endDeg)
  const endOuter = polar(cx, cy, rOuter, startDeg)
  const startInner = polar(cx, cy, rInner, startDeg)
  const endInner = polar(cx, cy, rInner, endDeg)
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1
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

export function Donut({
  slices,
  size = 160,
  thickness = 22,
  centerValue,
  centerLabel,
  className,
  showLegend = true,
}: DonutProps) {
  const { state, show, move, hide } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0 || slices.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }

  const cx = size / 2
  const cy = size / 2
  const rOuter = size / 2 - 1
  const rInner = rOuter - thickness
  const gapDeg = 0.6

  let cursor = 0
  const arcs = slices.map((s) => {
    const p = s.value / total
    const start = cursor + gapDeg / 2
    const end = cursor + p * 360 - gapDeg / 2
    cursor += p * 360
    return { ...s, pct: p, start, end }
  })

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        aria-hidden="true"
      >
        {arcs.map((a, i) => {
          const isHovered = hoverIdx === i
          return (
            <path
              key={`a-${i}`}
              d={arcPath(cx, cy, rOuter, rInner, a.start, a.end)}
              fill={a.color}
              stroke={isHovered ? '#fff' : 'none'}
              strokeWidth={isHovered ? 1.5 : 0}
              style={{ cursor: 'pointer' }}
              onPointerEnter={(e) => {
                setHoverIdx(i)
                show(e, a.label, [
                  { label: 'VALUE', value: a.value.toLocaleString('en-US') },
                  { label: '%', value: pct(a.value / total) },
                ])
              }}
              onPointerMove={(e) => move(e)}
              onPointerLeave={() => {
                setHoverIdx((curr) => (curr === i ? null : curr))
                hide()
              }}
            />
          )
        })}
        {centerValue ? (
          <text
            x={cx}
            y={centerLabel ? cy - 2 : cy + 5}
            textAnchor="middle"
            fontSize="18"
            fontFamily="ui-monospace, 'JetBrains Mono', monospace"
            fontWeight="600"
            fill="#000"
            style={{ fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}
          >
            {centerValue}
          </text>
        ) : null}
        {centerLabel ? (
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fontSize="9.5"
            fontFamily="ui-monospace, 'JetBrains Mono', monospace"
            fill="#000"
            fillOpacity={0.5}
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              pointerEvents: 'none',
            }}
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>

      {showLegend ? (
        <div className="flex flex-col gap-1.5 min-w-0">
          {arcs.map((a, i) => (
            <div
              key={`l-${i}`}
              className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.1em] text-black/80 leading-none"
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: a.color,
                  display: 'inline-block',
                }}
                aria-hidden="true"
              />
              <span className="truncate">{a.label}</span>
              <span className="tabular-nums text-black/55 ml-auto pl-3">
                {a.value.toLocaleString('en-US')}
              </span>
              <span className="tabular-nums text-black/40 w-10 text-right">
                {(a.pct * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <ChartTooltip state={state} />
    </div>
  )
}

export default Donut
