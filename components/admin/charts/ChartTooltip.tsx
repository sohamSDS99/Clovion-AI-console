'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export type TooltipRow = {
  color?: string
  label: string
  value: string
  subdued?: boolean
}

export type TooltipState = {
  x: number
  y: number
  title?: string
  rows: TooltipRow[]
} | null

const CURSOR_OFFSET = 12
const MAX_WIDTH = 280
const ESTIMATED_ROW_HEIGHT = 18
const HEADER_HEIGHT = 14
const PADDING_TOTAL_Y = 16
const ESTIMATED_DEFAULT_WIDTH = 180

function estimateTooltipSize(state: NonNullable<TooltipState>): {
  width: number
  height: number
} {
  // Estimate width: longest of (title length, label+value pair length)
  let maxChars = state.title ? state.title.length : 0
  for (const row of state.rows) {
    // label + value rough estimate
    const approx = row.label.length + row.value.length + 2
    if (approx > maxChars) maxChars = approx
  }
  // Approx 7px per char for uppercase small text — clamp by MAX_WIDTH
  const estWidth = Math.min(
    MAX_WIDTH,
    Math.max(ESTIMATED_DEFAULT_WIDTH, maxChars * 7 + 20),
  )

  // Single big-value variant (no color & only 1 row)
  const isSingleBig =
    state.rows.length === 1 && !state.rows[0].color
  const bodyHeight = isSingleBig
    ? 34
    : state.rows.length * ESTIMATED_ROW_HEIGHT
  const estHeight =
    bodyHeight + (state.title ? HEADER_HEIGHT + 4 : 0) + PADDING_TOTAL_Y

  return { width: estWidth, height: estHeight }
}

export function ChartTooltip({ state }: { state: TooltipState }) {
  const [mounted, setMounted] = useState(false)
  const [viewport, setViewport] = useState<{
    width: number
    height: number
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  })

  useEffect(() => {
    setMounted(true)
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!mounted) return null
  if (typeof document === 'undefined') return null

  const visible = state !== null
  // Compute position with edge flipping
  let left = 0
  let top = 0
  if (state) {
    const { width: estW, height: estH } = estimateTooltipSize(state)
    // Horizontal
    if (state.x + CURSOR_OFFSET + estW > viewport.width) {
      left = state.x - CURSOR_OFFSET - estW
    } else {
      left = state.x + CURSOR_OFFSET
    }
    // Vertical
    if (state.y + CURSOR_OFFSET + estH > viewport.height) {
      top = state.y - CURSOR_OFFSET - estH
    } else {
      top = state.y + CURSOR_OFFSET
    }
    // Clamp to viewport (prevent negative)
    if (left < 4) left = 4
    if (top < 4) top = 4
  }

  const isSingleBig =
    state !== null &&
    state.rows.length === 1 &&
    !state.rows[0].color

  const tooltip = (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)`,
        display: visible ? 'block' : 'none',
        pointerEvents: 'none',
        zIndex: 50,
        background: '#000',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 0,
        padding: '8px 10px',
        maxWidth: MAX_WIDTH,
        minWidth: 0,
        boxSizing: 'border-box',
        fontFamily:
          "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, monospace",
      }}
    >
      {state?.title ? (
        <div
          style={{
            fontSize: 9.5,
            lineHeight: 1.2,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            opacity: 0.55,
            marginBottom: 4,
            fontFamily:
              "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, monospace",
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {state.title}
        </div>
      ) : null}

      {state && isSingleBig ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.1,
              fontWeight: 600,
              fontFamily:
                "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, monospace",
              fontVariantNumeric: 'tabular-nums',
              wordBreak: 'break-word',
            }}
          >
            {state.rows[0].value}
          </div>
          <div
            style={{
              fontSize: 9.5,
              lineHeight: 1.2,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.55,
              wordBreak: 'break-word',
            }}
          >
            {state.rows[0].label}
          </div>
        </div>
      ) : null}

      {state && !isSingleBig ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            columnGap: 8,
            rowGap: 4,
            alignItems: 'center',
          }}
        >
          {state.rows.map((row, i) => {
            const opacity = row.subdued ? 0.55 : 1
            return (
              <div
                key={`row-${i}`}
                style={{ display: 'contents' }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    background: row.color ?? 'transparent',
                    flex: '0 0 auto',
                    opacity,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    lineHeight: 1.2,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    lineHeight: 1.2,
                    fontWeight: 600,
                    textAlign: 'right',
                    fontFamily:
                      "ui-monospace, 'JetBrains Mono', SFMono-Regular, Menlo, monospace",
                    fontVariantNumeric: 'tabular-nums',
                    opacity,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.value}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )

  return createPortal(tooltip, document.body)
}

export default ChartTooltip
