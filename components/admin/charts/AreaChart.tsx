'use client'

import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { ChartLegend } from './Legend'
import { ChartTooltip } from './ChartTooltip'
import { useTooltip } from './useTooltip'
import { useChartCursor } from './useChartCursor'

export type AreaSeries = {
  name: string
  color: string
  values: number[]
}

export type AreaChartProps = {
  series: AreaSeries[]
  height?: number
  width?: number
  xLabels?: string[]
  showLegend?: boolean
  smooth?: boolean
  yMin?: number
  yMax?: number
  className?: string
  /** Optional value formatter for tooltip values. Defaults to localized number with up to 2 decimals. */
  format?: (n: number) => string
}

type Point = readonly [number, number]

function defaultFormat(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function catmullRomPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) {
    const [x, y] = points[0]
    return `M${x.toFixed(2)},${y.toFixed(2)}`
  }
  const d: string[] = []
  d.push(`M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`)
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d.push(
      `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(
        2,
      )} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`,
    )
  }
  return d.join(' ')
}

function linearPath(points: Point[]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')
}

export function AreaChart({
  series,
  height = 180,
  width = 640,
  xLabels,
  showLegend = true,
  smooth = true,
  yMin,
  yMax,
  className,
  format,
}: AreaChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const tooltip = useTooltip()

  const padLeft = 32
  const padRight = 8
  const padTop = 10
  const padBottom = xLabels && xLabels.length > 0 ? 22 : 10

  const isEmpty =
    series.length === 0 || series.every((s) => s.values.length === 0)

  const n = isEmpty ? 0 : Math.max(...series.map((s) => s.values.length))

  const cursor = useChartCursor(svgRef, n, {
    paddingLeft: padLeft,
    paddingRight: padRight,
  })

  if (isEmpty) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }

  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom

  const allValues = series.flatMap((s) => s.values)
  const inferredMin = Math.min(...allValues, 0)
  const inferredMax = Math.max(...allValues, 1)
  const lo = yMin !== undefined ? yMin : inferredMin
  const hi = yMax !== undefined ? yMax : inferredMax
  const span = hi - lo || 1

  const stepX = n > 1 ? chartW / (n - 1) : chartW

  function xAt(i: number): number {
    return padLeft + (n > 1 ? i * stepX : chartW / 2)
  }
  function yAt(v: number): number {
    return padTop + (1 - (v - lo) / span) * chartH
  }

  function pointsFor(s: AreaSeries): Point[] {
    return s.values.map((v, i) => [xAt(i), yAt(v)] as const)
  }

  // y-axis ticks (4)
  const tickCount = 4
  const ticks: { v: number; y: number; label: string }[] = []
  for (let i = 0; i < tickCount; i++) {
    const t = i / (tickCount - 1)
    const v = lo + t * span
    const y = padTop + (1 - t) * chartH
    const label = Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)
    ticks.push({ v, y, label })
  }

  const fmt = format ?? defaultFormat
  const activeIndex = cursor.index

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    // Mimic the MouseEvent shape used by useChartCursor.onMove
    cursor.onMove(e as unknown as React.MouseEvent<SVGSVGElement>)
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    if (rect.width <= 0) return
    const xClient = e.clientX - rect.left
    const plotWidth = rect.width - padLeft - padRight
    if (plotWidth <= 0) return
    const ratio = (xClient - padLeft) / plotWidth
    const denom = n > 1 ? n - 1 : 1
    const raw = Math.round(ratio * denom)
    const idx = Math.max(0, Math.min(n - 1, raw))
    const title = xLabels?.[idx] ?? `#${idx}`
    const rows = series.map((s) => ({
      color: s.color,
      label: s.name,
      value: fmt(s.values[idx] ?? 0),
    }))
    tooltip.show(e.nativeEvent as MouseEvent, title, rows)
  }

  function handlePointerLeave() {
    cursor.onLeave()
    tooltip.hide()
  }

  return (
    <div className={cn('w-full', className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient
              key={`g-${i}`}
              id={`g-${i}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* y-axis ticks */}
        {ticks.map((t, i) => (
          <g key={`tick-${i}`}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={t.y}
              y2={t.y}
              stroke="#000"
              strokeOpacity={0.06}
              strokeWidth={1}
            />
            <text
              x={padLeft - 4}
              y={t.y + 3}
              textAnchor="end"
              fontSize="9"
              fontFamily="ui-monospace, 'JetBrains Mono', monospace"
              fill="#000"
              fillOpacity={0.4}
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* x-axis labels */}
        {xLabels && xLabels.length > 0 ? (
          <g>
            {xLabels.map((lbl, i) => {
              if (i % Math.max(1, Math.floor(xLabels.length / 8)) !== 0) return null
              const x = xAt(i)
              return (
                <text
                  key={`xl-${i}`}
                  x={x}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="ui-monospace, 'JetBrains Mono', monospace"
                  fill="#000"
                  fillOpacity={0.45}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
                >
                  {lbl}
                </text>
              )
            })}
          </g>
        ) : null}

        {/* areas + lines */}
        {series.map((s, i) => {
          const pts = pointsFor(s)
          if (pts.length === 0) return null
          const strokeD = smooth ? catmullRomPath(pts) : linearPath(pts)
          const baselineY = padTop + chartH
          const first = pts[0]
          const last = pts[pts.length - 1]
          const fillD =
            strokeD +
            ` L${last[0].toFixed(2)},${baselineY.toFixed(2)}` +
            ` L${first[0].toFixed(2)},${baselineY.toFixed(2)} Z`
          return (
            <g key={`s-${i}`}>
              <path d={fillD} fill={`url(#g-${i})`} stroke="none" />
              <path
                d={strokeD}
                fill="none"
                stroke={s.color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={last[0]} cy={last[1]} r={2.25} fill={s.color} />
            </g>
          )
        })}

        {/* hover crosshair + point markers */}
        {activeIndex !== null ? (
          <g pointerEvents="none">
            <line
              x1={xAt(activeIndex)}
              x2={xAt(activeIndex)}
              y1={padTop}
              y2={padTop + chartH}
              stroke="#000"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {series.map((s, i) => {
              const v = s.values[activeIndex]
              if (v === undefined) return null
              return (
                <circle
                  key={`hp-${i}`}
                  cx={xAt(activeIndex)}
                  cy={yAt(v)}
                  r={3}
                  fill={s.color}
                  stroke="#000"
                  strokeOpacity={0.0}
                  strokeWidth={0}
                />
              )
            })}
          </g>
        ) : null}
      </svg>

      {showLegend ? (
        <ChartLegend
          className="mt-2"
          items={series.map((s) => ({ label: s.name, color: s.color }))}
        />
      ) : null}

      <ChartTooltip state={tooltip.state} />
    </div>
  )
}

export default AreaChart
