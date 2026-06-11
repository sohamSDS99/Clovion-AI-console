'use client'

import type React from 'react'
import type { RefObject } from 'react'
import { useCallback, useState } from 'react'

export type UseChartCursorOptions = {
  /** Left padding of the plot area in SVG/client pixels. Default 32. */
  paddingLeft?: number
  /** Right padding of the plot area in SVG/client pixels. Default 8. */
  paddingRight?: number
}

export type UseChartCursorReturn = {
  index: number | null
  onMove: (e: React.MouseEvent<SVGSVGElement>) => void
  onLeave: () => void
}

const DEFAULT_PADDING_LEFT = 32
const DEFAULT_PADDING_RIGHT = 8

export function useChartCursor(
  svgRef: RefObject<SVGSVGElement | null>,
  dataLength: number,
  options: UseChartCursorOptions = {},
): UseChartCursorReturn {
  const paddingLeft = options.paddingLeft ?? DEFAULT_PADDING_LEFT
  const paddingRight = options.paddingRight ?? DEFAULT_PADDING_RIGHT

  const [index, setIndex] = useState<number | null>(null)

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      if (dataLength <= 0) {
        setIndex(null)
        return
      }
      const rect = svg.getBoundingClientRect()
      if (rect.width <= 0) return
      const x = e.clientX - rect.left
      const plotWidth = rect.width - paddingLeft - paddingRight
      if (plotWidth <= 0) {
        setIndex(0)
        return
      }
      const ratio = (x - paddingLeft) / plotWidth
      const denom = dataLength > 1 ? dataLength - 1 : 1
      const raw = Math.round(ratio * denom)
      const clamped = Math.max(0, Math.min(dataLength - 1, raw))
      setIndex(clamped)
    },
    [svgRef, dataLength, paddingLeft, paddingRight],
  )

  const onLeave = useCallback(() => {
    setIndex(null)
  }, [])

  return { index, onMove, onLeave }
}

export default useChartCursor
