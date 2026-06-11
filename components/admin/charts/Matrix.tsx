'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ChartTooltip, type TooltipRow } from './ChartTooltip'
import { useTooltip } from './useTooltip'

export type MatrixRow = { key: string; label: string }
export type MatrixCol = { key: string; label: string }
export type MatrixValue = { row: string; col: string; value: number }

export type MatrixProps = {
  rows: MatrixRow[]
  cols: MatrixCol[]
  /** Sparse — missing cells render 0. */
  values: MatrixValue[]
  /** Auto-computed from values if absent. */
  max?: number
  /** Cell size in px. Default 16. */
  cellSize?: number
  /** Single uniform cell fill (legacy). Intensity via opacity = value/max. */
  color?: string
  /**
   * Optional per-row base color array. Each row's cells use
   * `colors[rowIdx % colors.length]` as the fill, with opacity encoding
   * value/max. Highest priority over `color`.
   */
  colors?: string[]
  /** Default true. */
  showRowLabels?: boolean
  /** Default true. */
  showColLabels?: boolean
  /** Optional title row above the grid. */
  title?: string
  /** Show 0..max gradient legend on the right. */
  legend?: boolean
  className?: string
}

const LEGEND_STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1]

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function rowLabelWidth(rows: MatrixRow[]): number {
  // Heuristic: 100–140 px depending on the longest label length.
  const longest = rows.reduce((m, r) => Math.max(m, r.label.length), 0)
  if (longest <= 10) return 100
  if (longest <= 16) return 120
  return 140
}

function pct(t: number): string {
  return `${Math.round(clamp01(t) * 100)}%`
}

export function Matrix({
  rows,
  cols,
  values,
  max,
  cellSize = 16,
  color = '#000000',
  colors,
  showRowLabels = true,
  showColLabels = true,
  title,
  legend = false,
  className,
}: MatrixProps) {
  const { state, show, move, hide } = useTooltip()
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null)

  // Build lookup map row|col -> value (last write wins).
  const lookup = new Map<string, number>()
  let computedMax = 0
  for (const v of values) {
    lookup.set(`${v.row} ${v.col}`, v.value)
    if (v.value > computedMax) computedMax = v.value
  }
  const effectiveMax = typeof max === 'number' && max > 0 ? max : computedMax
  const safeMax = effectiveMax > 0 ? effectiveMax : 1

  const gap = 1 // 1px gap between cells
  const stride = cellSize + gap
  const gridWidth = cols.length * stride - (cols.length > 0 ? gap : 0)
  const gridHeight = rows.length * stride - (rows.length > 0 ? gap : 0)

  const labelWidth = showRowLabels ? rowLabelWidth(rows) : 0
  const colLabelHeight = showColLabels ? 80 : 0 // room for rotated labels
  const colLabelPad = 6
  const legendWidth = legend ? 88 : 0

  const totalWidth = labelWidth + gridWidth + (legend ? legendWidth + 12 : 0)
  const totalHeight = colLabelHeight + gridHeight

  const useColors = colors && colors.length > 0
  const colorForRow = (ri: number): string =>
    useColors ? colors![ri % colors!.length] : color

  return (
    <div className={cn('font-mono', className)} style={{ width: totalWidth }}>
      {title ? (
        <div
          className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55"
          style={{ marginBottom: 6 }}
        >
          {title}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        role="img"
        aria-label={title ?? 'Matrix heatmap'}
      >
        {/* Column labels (rotated -45deg) */}
        {showColLabels
          ? cols.map((c, ci) => {
              const x = labelWidth + ci * stride + cellSize / 2
              const y = colLabelHeight - colLabelPad
              return (
                <text
                  key={`col-${c.key}`}
                  x={x}
                  y={y}
                  fontSize={9.5}
                  fill="#000"
                  fillOpacity={0.55}
                  textAnchor="end"
                  transform={`rotate(-45 ${x} ${y})`}
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {c.label}
                </text>
              )
            })
          : null}

        {/* Row labels (right-aligned, flush with grid) */}
        {showRowLabels
          ? rows.map((r, ri) => {
              const y = colLabelHeight + ri * stride + cellSize / 2 + 3
              return (
                <text
                  key={`row-${r.key}`}
                  x={labelWidth - 6}
                  y={y}
                  fontSize={9.5}
                  fill="#000"
                  fillOpacity={0.55}
                  textAnchor="end"
                  style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {r.label}
                </text>
              )
            })
          : null}

        {/* Cells */}
        {rows.map((r, ri) =>
          cols.map((c, ci) => {
            const v = lookup.get(`${r.key} ${c.key}`) ?? 0
            const x = labelWidth + ci * stride
            const y = colLabelHeight + ri * stride
            const isZero = v === 0
            const intensity = clamp01(v / safeMax)
            const isHovered =
              hovered !== null && hovered.r === ri && hovered.c === ci
            const cellColor = colorForRow(ri)
            // Highlight: for filled darker cells use white inset, for zero/light cells use black 0.8.
            // In palette-color mode the cell is rarely "dark" in the grayscale sense; pick
            // contrast based on intensity threshold of 0.55.
            const useWhite = !isZero && intensity >= 0.55
            const hoverStroke = isHovered
              ? useWhite
                ? '#fff'
                : 'rgba(0,0,0,0.8)'
              : isZero
                ? '#000'
                : 'none'
            const hoverStrokeOpacity = isHovered
              ? 1
              : isZero
                ? 0.05
                : 0
            const hoverStrokeWidth = isHovered ? 1.5 : isZero ? 1 : 0
            return (
              <rect
                key={`cell-${r.key}-${c.key}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={isZero ? 'none' : cellColor}
                fillOpacity={isZero ? 0 : intensity}
                stroke={hoverStroke}
                strokeOpacity={hoverStrokeOpacity}
                strokeWidth={hoverStrokeWidth}
                style={{ cursor: 'default' }}
                onPointerEnter={(e) => {
                  setHovered({ r: ri, c: ci })
                  const rows: TooltipRow[] = [
                    { label: 'VALUE', value: v.toLocaleString() },
                  ]
                  if (effectiveMax > 0) {
                    rows.push({
                      label: 'INTENSITY',
                      value: pct(v / effectiveMax),
                    })
                  }
                  show(e, `${r.label} × ${c.label}`, rows)
                }}
                onPointerMove={(e) => move(e)}
                onPointerLeave={() => {
                  setHovered(null)
                  hide()
                }}
              >
                <title>{`${r.label} × ${c.label}: ${v.toLocaleString('en-US')}`}</title>
              </rect>
            )
          }),
        )}

        {/* Legend */}
        {legend ? (
          <g>
            {LEGEND_STOPS.map((stop, i) => {
              const swatchSize = 10
              const swatchGap = 4
              const xBase = labelWidth + gridWidth + 12
              const y = colLabelHeight + i * (swatchSize + swatchGap)
              const valueLabel =
                stop === 0
                  ? '0'
                  : Math.round(stop * safeMax).toLocaleString('en-US')
              // For the legend, use the first palette color in color mode so
              // the gradient stays consistent with the multicolor rows.
              const legendColor = useColors ? colors![0] : color
              return (
                <g key={`legend-${i}`}>
                  <rect
                    x={xBase}
                    y={y}
                    width={swatchSize}
                    height={swatchSize}
                    fill={stop === 0 ? 'none' : legendColor}
                    fillOpacity={stop === 0 ? 0 : stop}
                    stroke={stop === 0 ? '#000' : 'none'}
                    strokeOpacity={stop === 0 ? 0.05 : 0}
                    strokeWidth={stop === 0 ? 1 : 0}
                  />
                  <text
                    x={xBase + swatchSize + 6}
                    y={y + swatchSize - 1}
                    fontSize={9.5}
                    fill="#000"
                    fillOpacity={0.55}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {`${Math.round(stop * 100)}% · ${valueLabel}`}
                  </text>
                </g>
              )
            })}
          </g>
        ) : null}
      </svg>
      <ChartTooltip state={state} />
    </div>
  )
}

export default Matrix
