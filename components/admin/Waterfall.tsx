'use client'

import { cn } from '@/lib/cn'
import { ChartTooltip } from '@/components/admin/charts/ChartTooltip'
import { useTooltip } from '@/components/admin/charts/useTooltip'
import { useState } from 'react'

export type WaterfallKind = 'start' | 'positive' | 'negative' | 'end'

export type WaterfallBar = {
  label: string
  value: number
  kind: WaterfallKind
}

export type WaterfallProps = {
  bars: WaterfallBar[]
  height?: number
  width?: number
  /** Formatter for the value labels above bars (raw value). */
  format?: (v: number) => string
  /**
   * Optional per-bar color array. When set, each bar's fill (for filled
   * variants) or stroke (for outlined negatives) is indexed from this array.
   * The outlined-vs-solid semantic is preserved so users still distinguish
   * negative contributions.
   */
  colors?: string[]
  className?: string
}

export function Waterfall({
  bars,
  height = 160,
  width = 640,
  format = (v) => v.toLocaleString('en-US'),
  colors,
  className,
}: WaterfallProps) {
  const { state, show, move, hide } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (bars.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }

  // Compute running totals and segment ranges for each bar.
  let running = 0
  const segments = bars.map((b) => {
    if (b.kind === 'start' || b.kind === 'end') {
      const seg = {
        from: 0,
        to: b.value,
        raw: b.value,
        kind: b.kind,
        label: b.label,
        running: b.value,
      }
      running = b.value
      return seg
    }
    if (b.kind === 'positive') {
      const from = running
      const to = running + b.value
      running = to
      return {
        from,
        to,
        raw: b.value,
        kind: b.kind,
        label: b.label,
        running: to,
      }
    }
    // negative
    const from = running
    const to = running - Math.abs(b.value)
    running = to
    return {
      from,
      to,
      raw: -Math.abs(b.value),
      kind: b.kind,
      label: b.label,
      running: to,
    }
  })

  const ys = segments.flatMap((s) => [s.from, s.to])
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(0, ...ys)
  const span = maxY - minY || 1

  const padX = 8
  const padTop = 18
  const padBottom = 30
  const chartH = height - padTop - padBottom
  const innerW = width - padX * 2
  const slot = innerW / bars.length
  const barW = Math.max(8, Math.floor(slot * 0.55))

  function yOf(v: number) {
    return padTop + (1 - (v - minY) / span) * chartH
  }

  const zeroY = yOf(0)

  // Resolve per-bar color. Default black (legacy) when `colors` is absent.
  const useColors = colors && colors.length > 0
  const colorAt = (i: number): string =>
    useColors ? colors![i % colors!.length] : '#000'

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* zero baseline */}
        <line
          x1={padX}
          x2={width - padX}
          y1={zeroY}
          y2={zeroY}
          stroke="#000"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
        {segments.map((s, i) => {
          const cx = padX + slot * i + slot / 2
          const x = cx - barW / 2
          const top = Math.min(yOf(s.from), yOf(s.to))
          const bottom = Math.max(yOf(s.from), yOf(s.to))
          const h = Math.max(2, bottom - top)
          const isFilled = s.kind === 'start' || s.kind === 'end' || s.kind === 'positive'
          const isAnchor = s.kind === 'start' || s.kind === 'end'
          const isHovered = hoverIdx === i

          const isTotal = s.kind === 'start' || s.kind === 'end'
          const tooltipRows = [
            {
              label: isTotal
                ? 'TOTAL'
                : s.raw >= 0
                  ? '+CONTRIBUTION'
                  : '-CONTRIBUTION',
              value: format(Math.abs(s.raw)),
            },
            { label: 'RUNNING', value: format(s.running) },
          ]

          // Per-bar palette color (or black fallback).
          const barColor = colorAt(i)
          // Fill: filled variants use the bar color; outlined negatives stay
          // hollow with a subtle wash so the outlined-negative semantic remains.
          const fill = isFilled ? barColor : 'rgba(0,0,0,0.05)'
          // Stroke encodes the negative semantic when not filled. Use the
          // palette color so the bar still picks up its hue.
          const stroke = isFilled ? barColor : barColor
          // Inset stroke (hover). Filled cells use a white inset; outlined
          // cells use a white inset only when the underlying fill is dark
          // enough; otherwise black-ish.
          const insetStrokeColor = isFilled ? '#fff' : '#000'

          return (
            <g key={`${s.label}-${i}`}>
              {/* connector to previous */}
              {i > 0 ? (
                <line
                  x1={padX + slot * (i - 1) + slot / 2 + barW / 2}
                  x2={x}
                  y1={yOf(segments[i - 1].to)}
                  y2={yOf(segments[i - 1].to)}
                  stroke="#000"
                  strokeOpacity={0.25}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              ) : null}
              {/* bar */}
              <rect
                x={x}
                y={top}
                width={barW}
                height={h}
                fill={fill}
                stroke={stroke}
                strokeWidth={1}
                style={{ cursor: 'pointer' }}
                onPointerEnter={(e) => {
                  setHoverIdx(i)
                  show(e, s.label, tooltipRows)
                }}
                onPointerMove={(e) => move(e)}
                onPointerLeave={() => {
                  setHoverIdx((curr) => (curr === i ? null : curr))
                  hide()
                }}
              />
              {/* hover inset stroke */}
              {isHovered ? (
                <rect
                  x={x + 0.75}
                  y={top + 0.75}
                  width={Math.max(0, barW - 1.5)}
                  height={Math.max(0, h - 1.5)}
                  fill="none"
                  stroke={insetStrokeColor}
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              ) : null}
              {/* anchor underbar */}
              {isAnchor ? (
                <line
                  x1={x - 4}
                  x2={x + barW + 4}
                  y1={bottom + 2}
                  y2={bottom + 2}
                  stroke="#000"
                  strokeWidth={1}
                  pointerEvents="none"
                />
              ) : null}
              {/* value label above */}
              <text
                x={cx}
                y={top - 4}
                fontSize="9.5"
                fontFamily="ui-monospace, 'JetBrains Mono', monospace"
                textAnchor="middle"
                fill="#000"
                style={{ pointerEvents: 'none' }}
              >
                {format(s.raw)}
              </text>
              {/* label below */}
              <text
                x={cx}
                y={height - padBottom + 14}
                fontSize="9.5"
                fontFamily="ui-monospace, 'JetBrains Mono', monospace"
                textAnchor="middle"
                fill="#000"
                fillOpacity={0.7}
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  pointerEvents: 'none',
                }}
              >
                {s.label}
              </text>
            </g>
          )
        })}
      </svg>

      <ChartTooltip state={state} />
    </div>
  )
}

export default Waterfall
