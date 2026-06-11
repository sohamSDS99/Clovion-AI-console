import { cn } from '@/lib/cn'

export type CalendarCell = {
  date: string // YYYY-MM-DD
  value: number
}

export type CalendarProps = {
  values: CalendarCell[]
  max?: number
  /** Single hue used at varying opacity. Defaults to chart-1. */
  color?: string
  cellSize?: number
  cellGap?: number
  className?: string
}

const DAY_LABELS = ['MON', 'WED', 'FRI']

function parseDate(s: string): Date {
  // YYYY-MM-DD — parse as UTC to avoid TZ skew
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayOfWeekMon0(d: Date): number {
  // 0 = Monday, 6 = Sunday
  const js = d.getUTCDay() // 0 Sun .. 6 Sat
  return (js + 6) % 7
}

export function Calendar({
  values,
  max,
  color = '#6366f1',
  cellSize = 10,
  cellGap = 2,
  className,
}: CalendarProps) {
  if (values.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }

  const map = new Map<string, number>()
  values.forEach((v) => map.set(v.date, v.value))

  const inferredMax = values.reduce((m, v) => Math.max(m, v.value), 0)
  const effectiveMax = max ?? inferredMax

  // Find date range
  const dates = values.map((v) => parseDate(v.date)).sort((a, b) => +a - +b)
  const end = dates[dates.length - 1]
  // Always end on Sunday of that week to align grid
  const endDow = dayOfWeekMon0(end)
  const lastSunday = new Date(end)
  lastSunday.setUTCDate(end.getUTCDate() + (6 - endDow))
  // Show ~12 weeks
  const weeks = 12
  const firstMonday = new Date(lastSunday)
  firstMonday.setUTCDate(lastSunday.getUTCDate() - (weeks * 7 - 1))

  // Build cells [row=day][col=week]
  const cells: { date: string; value: number; inRange: boolean }[][] = []
  for (let r = 0; r < 7; r++) {
    const row: { date: string; value: number; inRange: boolean }[] = []
    for (let c = 0; c < weeks; c++) {
      const dt = new Date(firstMonday)
      dt.setUTCDate(firstMonday.getUTCDate() + c * 7 + r)
      const k = dateKey(dt)
      const v = map.get(k) ?? 0
      row.push({ date: k, value: v, inRange: dt >= dates[0] && dt <= end })
    }
    cells.push(row)
  }

  // Month labels for column tops — show month abbrev when first-of-month appears in the column
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1
  for (let c = 0; c < weeks; c++) {
    const dt = new Date(firstMonday)
    dt.setUTCDate(firstMonday.getUTCDate() + c * 7)
    const m = dt.getUTCMonth()
    if (m !== lastMonth) {
      lastMonth = m
      monthLabels.push({
        col: c,
        label: dt
          .toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
          .toUpperCase(),
      })
    }
  }

  const labelWidth = 28

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Month label row */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${labelWidth}px repeat(${weeks}, ${cellSize}px)`,
          columnGap: cellGap,
        }}
      >
        <span />
        {Array.from({ length: weeks }).map((_, c) => {
          const ml = monthLabels.find((x) => x.col === c)
          return (
            <span
              key={`m-${c}`}
              className="text-[8.5px] font-mono uppercase tracking-[0.12em] text-black/45 leading-none"
              style={{ width: cellSize }}
            >
              {ml ? ml.label : ''}
            </span>
          )
        })}
      </div>

      {cells.map((row, r) => (
        <div
          key={`r-${r}`}
          className="grid items-center"
          style={{
            gridTemplateColumns: `${labelWidth}px repeat(${weeks}, ${cellSize}px)`,
            columnGap: cellGap,
            height: cellSize,
          }}
        >
          <span className="text-[8.5px] font-mono uppercase tracking-[0.12em] text-black/40 leading-none">
            {r === 0 ? DAY_LABELS[0] : r === 2 ? DAY_LABELS[1] : r === 4 ? DAY_LABELS[2] : ''}
          </span>
          {row.map((cell, c) => {
            const op = !cell.inRange
              ? 0.04
              : effectiveMax > 0
                ? Math.max(0.06, Math.min(1, cell.value / effectiveMax))
                : 0.06
            return (
              <span
                key={`c-${r}-${c}`}
                title={`${cell.date}: ${cell.value}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: color,
                  opacity: op,
                  display: 'inline-block',
                }}
                aria-label={`${cell.date}: ${cell.value}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default Calendar
