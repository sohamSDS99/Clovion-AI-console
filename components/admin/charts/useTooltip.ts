'use client'

import type React from 'react'
import { useCallback, useState } from 'react'
import type { TooltipRow, TooltipState } from './ChartTooltip'

export function useTooltip() {
  const [state, setState] = useState<TooltipState>(null)

  const show = useCallback(
    (
      e: React.MouseEvent | MouseEvent,
      title: string | undefined,
      rows: TooltipRow[],
    ) => {
      const x = 'clientX' in e ? e.clientX : 0
      const y = 'clientY' in e ? e.clientY : 0
      setState({ x, y, title, rows })
    },
    [],
  )

  const move = useCallback((e: React.MouseEvent | MouseEvent) => {
    const x = 'clientX' in e ? e.clientX : 0
    const y = 'clientY' in e ? e.clientY : 0
    setState((s) => (s ? { ...s, x, y } : s))
  }, [])

  const hide = useCallback(() => {
    setState(null)
  }, [])

  return { state, show, move, hide }
}

export default useTooltip
