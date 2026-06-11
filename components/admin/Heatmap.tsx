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
  className?: string
}

// 6-step grayscale from 0% to 100% black for the cell fill.
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

export function Heatmap({
  grid,
  rowLabels,
  colLabels,
  max,
  format,
  className,
}: HeatmapProps) {
  const inferredMax = grid.reduce(
    (m, row) => row.reduce((mm, v) => Math.max(mm, v), m),
    0,
  )
  const effectiveMax = max ?? inferredMax

  const { state, show, move, hide } = useTooltip()
  const [hovered, setHovered] = useState<{ r: number; c: number } | null>(null)

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
                const bg = stepFor(v, effectiveMax)
                const ratio = effectiveMax > 0 ? v / effectiveMax : 0
                // Text color flips to white once the cell is dark enough.
                const dark = ratio >= 0.55 ? '#fff' : '#000'
                const label = format ? format(v, ri, ci) : ''
                const isHovered =
                  hovered !== null && hovered.r === ri && hovered.c === ci
                const isDarkCell = ratio >= 0.55
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
