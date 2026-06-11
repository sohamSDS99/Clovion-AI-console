'use client'

// Client-side wrappers used by server pages so they can pass an inline
// arrow function to charts that are themselves client components. Next.js
// forbids passing functions across the server -> client boundary, but if the
// wrapper itself is a client component the function is created on the client.

import { Waterfall, type WaterfallBar } from '@/components/admin/Waterfall'
import { Heatmap } from '@/components/admin/Heatmap'
import { formatCents } from '@/lib/admin/format'

export function WaterfallCents({
  bars,
  height,
  width,
  colors,
}: {
  bars: WaterfallBar[]
  height?: number
  width?: number
  colors?: string[]
}) {
  return (
    <Waterfall
      bars={bars}
      height={height}
      width={width}
      colors={colors}
      format={(v) => formatCents(v, 0)}
    />
  )
}

export function HeatmapPercent({
  grid,
  rowLabels,
  colLabels,
  max,
  colors,
}: {
  grid: number[][]
  rowLabels: string[]
  colLabels: string[]
  max?: number
  colors?: string[]
}) {
  return (
    <Heatmap
      grid={grid}
      rowLabels={rowLabels}
      colLabels={colLabels}
      max={max}
      colors={colors}
      format={(v) => `${v}%`}
    />
  )
}

export function HeatmapInteger({
  grid,
  rowLabels,
  colLabels,
  max,
  colors,
}: {
  grid: number[][]
  rowLabels: string[]
  colLabels: string[]
  max?: number
  colors?: string[]
}) {
  return (
    <Heatmap
      grid={grid}
      rowLabels={rowLabels}
      colLabels={colLabels}
      max={max}
      colors={colors}
      format={(v) => (v > 0 ? `${v.toFixed(0)}` : '')}
    />
  )
}
