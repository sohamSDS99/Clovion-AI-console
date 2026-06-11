// Single source of truth for chart-palette cycling across pages.
// Order matches PRD severity convention loosely:
//   1 indigo (primary)  -> 2 emerald (positive)  -> 3 amber (warning)  -> 4 red (danger)
//   5 pink (accent)     -> 6 cyan (info)         -> 7 violet           -> 8 teal

export const CHART_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const

export type ChartColor = typeof CHART_PALETTE[number]

export function paletteAt(index: number): ChartColor {
  return CHART_PALETTE[((index % CHART_PALETTE.length) + CHART_PALETTE.length) % CHART_PALETTE.length]
}

/** Deterministic color for a string key — stable across renders. */
export function paletteForKey(key: string): ChartColor {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return paletteAt(Math.abs(hash))
}
