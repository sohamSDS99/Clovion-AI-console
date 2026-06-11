'use client'

import { cn } from '@/lib/cn'
import { Empty } from '@/components/admin/Empty'
import { ChartTooltip } from './ChartTooltip'
import { useTooltip } from './useTooltip'
import { useState } from 'react'
import { paletteAt } from '@/lib/admin/palette'

export type TaperedFunnelStep = {
  name: string
  entered: number
  completed: number
  medianHoursToStep?: number
}

export type TaperedFunnelProps = {
  steps: TaperedFunnelStep[]
  width?: number
  stepHeight?: number
  /** Single uniform fill (preserves existing usage). Used when `colors` is not provided. */
  color?: string
  /** Explicit per-step color array. Cycled with `colors[i % colors.length]`. Highest priority. */
  colors?: string[]
  className?: string
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0h'
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0).replace(/\.0$/, '')}h`
  const days = hours / 24
  return `${days.toFixed(days < 10 ? 1 : 0).replace(/\.0$/, '')}d`
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function pct(n: number) {
  if (!Number.isFinite(n)) return '0%'
  return `${(n * 100).toFixed(1)}%`
}

type Row = { label: string; value: string }

export function TaperedFunnel({
  steps,
  width = 640,
  stepHeight = 56,
  color,
  colors,
  className,
}: TaperedFunnelProps) {
  const { state, show, move, hide } = useTooltip()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (steps.length === 0) {
    return <Empty />
  }

  const first = steps[0]
  const firstEntered = first.entered > 0 ? first.entered : 1

  // Resolve per-step fill color. Priority:
  //   1) explicit `colors[]` per-step array
  //   2) uniform `color` prop (legacy)
  //   3) auto-cycle palette
  const resolveColor = (i: number): string => {
    if (colors && colors.length > 0) return colors[i % colors.length]
    if (color) return color
    return paletteAt(i)
  }

  // Compute each trapezoid's TOP width (= entered_i / entered_0 * width)
  // and BOTTOM width (= entered_{i+1} / entered_0 * width) so consecutive
  // trapezoids share an edge for the funnel taper.
  const stepWidths = steps.map((s) =>
    Math.max(0, (s.entered / firstEntered) * width),
  )

  // Side gutters for outer labels (left = hours, right = conversion + drop).
  const leftGutter = 64
  const rightGutter = 140
  const totalWidth = leftGutter + width + rightGutter
  const totalHeight = steps.length * stepHeight

  return (
    <div
      className={cn('font-mono', className)}
      style={{ width: totalWidth }}
    >
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        aria-label="Funnel chart"
        role="img"
      >
        {steps.map((s, i) => {
          const topW = stepWidths[i]
          const bottomW = i < steps.length - 1 ? stepWidths[i + 1] : topW
          const yTop = i * stepHeight
          const yBottom = yTop + stepHeight

          const topLeft = leftGutter + (width - topW) / 2
          const topRight = topLeft + topW
          const bottomLeft = leftGutter + (width - bottomW) / 2
          const bottomRight = bottomLeft + bottomW

          const centerX = leftGutter + width / 2
          const centerY = yTop + stepHeight / 2

          const points = [
            `${topLeft.toFixed(2)},${yTop.toFixed(2)}`,
            `${topRight.toFixed(2)},${yTop.toFixed(2)}`,
            `${bottomRight.toFixed(2)},${yBottom.toFixed(2)}`,
            `${bottomLeft.toFixed(2)},${yBottom.toFixed(2)}`,
          ].join(' ')

          // Conversion vs first step (rounded to 1 decimal).
          const convPct = firstEntered > 0 ? (s.entered / firstEntered) * 100 : 0
          // Drop from previous step.
          const drop = i === 0 ? 0 : steps[i - 1].entered - s.entered

          // Connector lines from previous step's bottom corners to this step's top corners.
          // (Already implicitly continuous since bottomW_{i-1} = topW_i, but we emit a faint
          // 1px guideline along the funnel edges separating each step.)
          const dividerY = yTop

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
            <g key={`step-${i}-${s.name}`}>
              {/* Trapezoid */}
              <polygon
                points={points}
                fill={fill}
                fillOpacity={0.18}
                stroke="#000"
                strokeOpacity={isHovered ? 0.8 : 0.4}
                strokeWidth={isHovered ? 1.5 : 1}
                style={{ cursor: 'pointer' }}
                onPointerEnter={(e) => {
                  setHoverIdx(i)
                  show(e, s.name, rows)
                }}
                onPointerMove={(e) => move(e)}
                onPointerLeave={() => {
                  setHoverIdx((curr) => (curr === i ? null : curr))
                  hide()
                }}
              />
              {/* Thin divider line at the top edge of each step (skip first) */}
              {i > 0 ? (
                <line
                  x1={topLeft.toFixed(2)}
                  y1={dividerY.toFixed(2)}
                  x2={topRight.toFixed(2)}
                  y2={dividerY.toFixed(2)}
                  stroke="#000"
                  strokeOpacity={0.15}
                  strokeWidth={1}
                  style={{ pointerEvents: 'none' }}
                />
              ) : null}
              {/* Step name (inside, centered top half) */}
              <text
                x={centerX}
                y={centerY - 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="#000"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontFamily: 'var(--sans)',
                  pointerEvents: 'none',
                }}
              >
                {s.name}
              </text>
              {/* Entered count (inside, centered bottom half) */}
              <text
                x={centerX}
                y={centerY + 12}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill="#000"
                style={{
                  fontFamily: 'var(--mono)',
                  fontVariantNumeric: 'tabular-nums',
                  pointerEvents: 'none',
                }}
              >
                {formatNumber(s.entered)}
              </text>
              {/* Left gutter: median hours-to-step */}
              {typeof s.medianHoursToStep === 'number' ? (
                <text
                  x={leftGutter - 8}
                  y={centerY + 3}
                  textAnchor="end"
                  fontSize={9.5}
                  fill="#000"
                  fillOpacity={0.55}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontVariantNumeric: 'tabular-nums',
                    pointerEvents: 'none',
                  }}
                >
                  {formatHours(s.medianHoursToStep)}
                </text>
              ) : null}
              {/* Right gutter: conversion % (line 1) + drop (line 2) */}
              <text
                x={leftGutter + width + 8}
                y={centerY - 2}
                textAnchor="start"
                fontSize={10}
                fill="#000"
                fillOpacity={0.75}
                style={{
                  fontFamily: 'var(--mono)',
                  fontVariantNumeric: 'tabular-nums',
                  pointerEvents: 'none',
                }}
              >
                {convPct.toFixed(1)}%
              </text>
              {i > 0 ? (
                <text
                  x={leftGutter + width + 8}
                  y={centerY + 11}
                  textAnchor="start"
                  fontSize={10}
                  fill="#000"
                  fillOpacity={0.45}
                  style={{
                    fontFamily: 'var(--mono)',
                    fontVariantNumeric: 'tabular-nums',
                    pointerEvents: 'none',
                  }}
                >
                  {`Δ -${formatNumber(Math.max(0, drop))} drop`}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      <ChartTooltip state={state} />
    </div>
  )
}

export default TaperedFunnel
