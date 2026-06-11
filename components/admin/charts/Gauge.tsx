'use client'

import { cn } from '@/lib/cn'
import { ChartTooltip } from './ChartTooltip'
import { useTooltip } from './useTooltip'
import { useState } from 'react'

export type GaugeProps = {
  value: number
  max: number
  /** Marks a tick on the arc at this value position. */
  target?: number
  /** Uppercase 9.5px tracking-[0.12em] opacity 0.55 above the gauge. */
  label: string
  /** Override the big center number (e.g. "$324 / $500"). */
  valueLabel?: string
  /** Small caption under center value (e.g. "80% used"). */
  metaLabel?: string
  /** Foreground arc color (default var(--chart-1)). */
  color?: string
  /** Outer width/height of the SVG. Default 160. */
  size?: number
  /** Stroke thickness of the arc. Default 14. */
  thickness?: number
  /** If true, switches arc to var(--chart-4) when value/max > 0.85. */
  danger?: boolean
  className?: string
}

/** Polar coordinate on a circle of radius r centered at (cx, cy), at angleDeg (0 = up, 90 = right). */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function pct(n: number) {
  if (!Number.isFinite(n)) return '0%'
  return `${(n * 100).toFixed(1)}%`
}

export function Gauge({
  value,
  max,
  target,
  label,
  valueLabel,
  metaLabel,
  color = 'var(--chart-1)',
  size = 160,
  thickness = 14,
  danger = false,
  className,
}: GaugeProps) {
  const { state, show, move, hide } = useTooltip()
  const [hovered, setHovered] = useState(false)

  const safeMax = max > 0 ? max : 1
  const ratio = Math.max(0, Math.min(1, value / safeMax))
  const isDanger = danger && ratio > 0.85
  const strokeColor = isDanger ? 'var(--chart-4)' : color

  // Geometry — semicircle from -90deg (left) through 90deg (right), sweep 180deg.
  // We render at the top of the SVG, leaving room below for the value/meta text.
  const pad = thickness / 2 + 1
  const cx = size / 2
  const cy = size / 2 + pad // baseline-ish; arc sits on this y
  const r = size / 2 - pad

  // Anchors of the semicircle (start at left, end at right, going over the top).
  const start = polar(cx, cy, r, -90) // left point (3 o'clock counter-clockwise)
  const end = polar(cx, cy, r, 90) // right point

  // Arc path: from start, over the top (large-arc-flag=0, sweep-flag=1), to end.
  const arcPath = [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(' ')

  // Total arc length = pi * r (semicircle circumference).
  const arcLen = Math.PI * r
  const fgLen = arcLen * ratio

  // Target tick at proportional position along the arc.
  // Map target value -> angle along the sweep from -90deg to 90deg.
  let targetMark: { x1: number; y1: number; x2: number; y2: number } | null = null
  if (typeof target === 'number' && target >= 0 && safeMax > 0) {
    const tRatio = Math.max(0, Math.min(1, target / safeMax))
    const angle = -90 + 180 * tRatio
    const inner = polar(cx, cy, r - thickness / 2, angle)
    const outer = polar(cx, cy, r + thickness / 2 + 6, angle) // extends 6px outward
    targetMark = { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y }
  }

  // Current-value tick (shown on hover)
  const valAngle = -90 + 180 * ratio
  const valInner = polar(cx, cy, r - thickness / 2, valAngle)
  const valOuter = polar(cx, cy, r + thickness / 2, valAngle)

  // Total SVG height: room for the upper half (size/2 + pad) + text area beneath the gauge baseline.
  const textBlockHeight = metaLabel ? 44 : 30
  const svgHeight = cy + textBlockHeight
  const valueY = cy - 6
  const metaY = cy + 12

  const tooltipRows = [
    { label: 'VALUE', value: valueLabel ?? String(value) },
    { label: 'OF', value: max.toLocaleString('en-US') },
    ...(target != null
      ? [{ label: 'TARGET', value: target.toLocaleString('en-US') }]
      : []),
    { label: 'USED', value: pct(value / safeMax) },
  ]

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      style={{ cursor: 'pointer' }}
      onPointerEnter={(e) => {
        setHovered(true)
        show(e, label, tooltipRows)
      }}
      onPointerMove={(e) => move(e)}
      onPointerLeave={() => {
        setHovered(false)
        hide()
      }}
    >
      <div
        className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55"
        style={{ marginBottom: 4 }}
      >
        {label}
      </div>
      <svg
        viewBox={`0 0 ${size} ${svgHeight}`}
        width={size}
        height={svgHeight}
        aria-label={`${label}: ${valueLabel ?? `${value} of ${max}`}`}
        role="img"
      >
        {/* Background arc */}
        <path
          d={arcPath}
          stroke="#000"
          strokeOpacity={0.08}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="butt"
        />
        {/* Foreground arc — stroke-dasharray driven */}
        {fgLen > 0 ? (
          <path
            d={arcPath}
            stroke={strokeColor}
            strokeWidth={thickness}
            fill="none"
            strokeLinecap="butt"
            strokeDasharray={`${fgLen.toFixed(2)} ${arcLen.toFixed(2)}`}
          />
        ) : null}
        {/* Target tick */}
        {targetMark ? (
          <line
            x1={targetMark.x1.toFixed(2)}
            y1={targetMark.y1.toFixed(2)}
            x2={targetMark.x2.toFixed(2)}
            y2={targetMark.y2.toFixed(2)}
            stroke="#000"
            strokeWidth={1}
          />
        ) : null}
        {/* Hover tick at current value */}
        {hovered && ratio > 0 ? (
          <line
            x1={valInner.x.toFixed(2)}
            y1={valInner.y.toFixed(2)}
            x2={valOuter.x.toFixed(2)}
            y2={valOuter.y.toFixed(2)}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ) : null}
        {/* Center value */}
        <text
          x={cx}
          y={valueY}
          textAnchor="middle"
          fontSize={24}
          fontWeight={600}
          fill="#000"
          style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--sans)' }}
        >
          {valueLabel ?? `${value}`}
        </text>
        {metaLabel ? (
          <text
            x={cx}
            y={metaY}
            textAnchor="middle"
            fontSize={10}
            fill="#000"
            fillOpacity={0.45}
            style={{
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontFamily: 'var(--sans)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {metaLabel}
          </text>
        ) : null}
      </svg>

      <ChartTooltip state={state} />
    </div>
  )
}

export default Gauge
