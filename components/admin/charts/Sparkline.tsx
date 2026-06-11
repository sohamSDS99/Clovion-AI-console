'use client'

import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { ChartTooltip } from './ChartTooltip'
import { useTooltip } from './useTooltip'
import { useChartCursor } from './useChartCursor'

export type SparklineProps = {
  values: number[]
  width?: number
  height?: number
  stroke?: number
  className?: string
  /** Optional stroke color. Defaults to black. */
  color?: string
  /** Optional x-axis labels for tooltip context. */
  xLabels?: string[]
  /** Optional series label. Used in tooltip row. */
  label?: string
  /** Optional value formatter for tooltip. Defaults to localized number with up to 2 decimals. */
  format?: (n: number) => string
}

function defaultFormat(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function Sparkline({
  values,
  width = 60,
  height = 18,
  stroke = 1.25,
  className,
  color = '#000',
  xLabels,
  label,
  format,
}: SparklineProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltip = useTooltip()

  const n = values?.length ?? 0
  const cursor = useChartCursor(svgRef, n, {
    paddingLeft: 0,
    paddingRight: 0,
  })

  if (!values || values.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn('shrink-0', className)}
        aria-hidden="true"
      />
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = n > 1 ? width / (n - 1) : width

  function xAt(i: number): number {
    return n > 1 ? i * stepX : width / 2
  }
  function yAt(v: number): number {
    return height - ((v - min) / span) * height
  }

  const points = values.map((v, i) => [xAt(i), yAt(v)] as const)

  const d = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')

  const [lx, ly] = points[points.length - 1]
  const fmt = format ?? defaultFormat
  const activeIndex = cursor.index

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    cursor.onMove(e as unknown as React.MouseEvent<SVGSVGElement>)
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    if (rect.width <= 0) return
    const xClient = e.clientX - rect.left
    const ratio = xClient / rect.width
    const denom = n > 1 ? n - 1 : 1
    const raw = Math.round(ratio * denom)
    const idx = Math.max(0, Math.min(n - 1, raw))
    const title = xLabels?.[idx]
    const rows = [
      {
        color,
        label: label ?? 'VALUE',
        value: fmt(values[idx] ?? 0),
      },
    ]
    tooltip.show(e.nativeEvent as MouseEvent, title, rows)
  }

  function handlePointerLeave() {
    cursor.onLeave()
    tooltip.hide()
  }

  return (
    <span className={cn('inline-block align-middle', className)}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0 block"
        aria-hidden="true"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinejoin="miter"
        />
        <circle cx={lx} cy={ly} r={2} fill={color} />
        {activeIndex !== null && values[activeIndex] !== undefined ? (
          <circle
            cx={xAt(activeIndex)}
            cy={yAt(values[activeIndex])}
            r={2.5}
            fill={color}
            pointerEvents="none"
          />
        ) : null}
      </svg>
      <ChartTooltip state={tooltip.state} />
    </span>
  )
}

export default Sparkline
