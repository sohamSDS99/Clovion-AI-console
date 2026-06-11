'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { ChartTooltip } from './charts/ChartTooltip'
import { useTooltip } from './charts/useTooltip'

export type HeatmapProps = {
  grid: number[][]
  rowLabels: string[]
  colLabels: string[]
  /** Override max (else inferred from data). */
  max?: number
  /** Cell formatter; if returned string is non-empty it's rendered inside the cell. */
  format?: (v: number, row: number, col: number) => string
  /**
   * Optional per-row base colors. When set, each row's cells use
   * `colors[rowIdx % colors.length]` as the base color and opacity still
   * encodes value/max. When absent, grayscale fallback (legacy).
   */
  colors?: string[]
  className?: string
}

// 6-step grayscale from 0% to 100% black for the cell fill (legacy fallback).
const STEPS = [
  'rgba(0,0,0,0.00)',
  'rgba(0,0,0,0.18)',
  'rgba(0,0,0,0.36)',
  'rgba(0,0,0,0.54)',
  'rgba(0,0,0,0.72)',
  'rgba(0,0,0,1.00)',
] as const

function stepFor(v: number, max: number): string {
  if (max <= 0) return STEPS[0]
  const t = Math.max(0, Math.min(1, v / max))
  const idx = Math.min(STEPS.length - 1, Math.floor(t * (STEPS.length - 0.0001)))
  return STEPS[idx]
}

// Discrete opacity ramp for the colored mode — preserves the stepped visual
// language of the grayscale Heatmap while encoding value within a row's hue.
const OPACITY_STEPS = [0, 0.18, 0.36, 0.54, 0.72, 1] as const

function opacityFor(v: number, max: number): number {
  if (max <= 0) return 0
  const t = Math.max(0, Math.min(1, v / max))
  const idx = Math.min(
    OPACITY_STEPS.length - 1,
    Math.floor(t * (OPACITY_STEPS.length - 0.0001)),
  )
  return OPACITY_STEPS[idx]
}

export function Heatmap({
  grid,
  rowLabels,
  colLabels,
  max,
  format,
  colors,
  className,
}: HeatmapProps) {
  const inferredMax = grid.reduce(
    (m, row) => row.reduce((mm, v) => Math.max(mm, v), m),
    0,
  )
  const effectiveMax = max ?? inferredMax

  const { state, show, move, hide } = useTooltip()
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null)

  const useColors = colors && colors.length > 0

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table
        className="border-separate text-[9.5px] font-mono tabular-nums"
        style={{ borderSpacing: 1, background: '#fff' }}
      >
        <thead>
          <tr>
            <th className="text-left text-black/45 uppercase tracking-[0.12em] pr-2 pb-1 align-bottom">
              {' '}
            </th>
            {colLabels.map((c, i) => (
              <th
                key={`c-${i}`}
                className="text-black/55 uppercase tracking-[0.12em] px-1 pb-1 text-center align-bottom font-normal"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row, ri) => (
            <tr key={`r-${ri}`}>
              <th className="text-right text-black/55 uppercase tracking-[0.12em] pr-2 align-middle font-normal whitespace-nowrap">
                {rowLabels[ri] ?? ''}
              </th>
              {row.map((v, ci) => {
                const ratio = effectiveMax > 0 ? v / effectiveMax : 0
                const rowColor = useColors
                  ? colors![ri % colors!.length]
                  : '#000000'
                // Compute background.
                const bg = useColors
                  ? rowColor
                  : stepFor(v, effectiveMax)
                const op = useColors ? opacityFor(v, effectiveMax) : 1
                // Labels stay black for legibility. Determine if cell is dark
                // enough to flip label color to white — only in grayscale mode
                // (palette colors keep labels black per spec).
                const dark =
                  !useColors && ratio >= 0.55 ? '#fff' : '#000'
                const label = format ? format(v, ri, ci) : ''
                const isHovered =
                  hovered !== null && hovered.r === ri && hovered.c === ci
                const isDarkCell = !useColors && ratio >= 0.55
                const outline = isHovered
                  ? isDarkCell
                    ? 'inset 0 0 0 1.5px rgba(255,255,255,1)'
                    : 'inset 0 0 0 1.5px rgba(0,0,0,0.8)'
                  : undefined
                const rowLabel = rowLabels[ri] ?? ''
                const colLabel = colLabels[ci] ?? ''
                const formatted = format
                  ? format(v, ri, ci) || v.toLocaleString('en-US')
                  : v.toLocaleString('en-US')
                return (
                  <td
                    key={`c-${ri}-${ci}`}
                    style={{
                      backgroundColor: bg,
                      opacity: useColors ? op : 1,
                      color: dark,
                      minWidth: 28,
                      height: 22,
                      textAlign: 'center',
                      padding: '0 4px',
                      boxShadow: outline,
                      cursor: 'default',
                    }}
                    onPointerEnter={(e) => {
                      setHovered({ r: ri, c: ci })
                      show(e, `${rowLabel} × ${colLabel}`, [
                        { label: 'VALUE', value: formatted },
                      ])
                    }}
                    onPointerMove={(e) => move(e)}
                    onPointerLeave={() => {
                      setHovered(null)
                      hide()
                    }}
                  >
                    {label}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ChartTooltip state={state} />
    </div>
  )
}

export default Heatmap
