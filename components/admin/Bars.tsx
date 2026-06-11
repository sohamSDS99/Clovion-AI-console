import { cn } from '@/lib/cn'

export type BarRow = {
  label: string
  value: number
  /** Optional override max for normalization. */
  max?: number
  /** Optional display string (else the value is rendered). */
  display?: string
}

export type BarsProps = {
  rows: BarRow[]
  height?: number
  labelWidth?: number
  className?: string
  /** Default formatter for the value when row.display is absent. */
  format?: (v: number) => string
}

export function Bars({
  rows,
  height = 20,
  labelWidth = 80,
  className,
  format = (v) => v.toLocaleString('en-US'),
}: BarsProps) {
  const explicitMax = rows.reduce((m, r) => Math.max(m, r.max ?? 0), 0)
  const valuesMax = rows.reduce((m, r) => Math.max(m, r.value), 0)
  const max = explicitMax > 0 ? explicitMax : valuesMax || 1

  return (
    <div className={cn('flex flex-col', className)} style={{ rowGap: 2 }}>
      {rows.map((r, i) => {
        const pct = Math.max(0, Math.min(1, r.value / max))
        return (
          <div
            key={`${r.label}-${i}`}
            className="grid items-center gap-2"
            style={{
              gridTemplateColumns: `${labelWidth}px 1fr auto`,
              height,
            }}
          >
            <span className="text-[10px] font-mono tabular-nums uppercase tracking-[0.08em] text-black/60 truncate">
              {r.label}
            </span>
            <div
              className="relative bg-black/5"
              style={{ height: Math.max(2, Math.floor(height / 2.5)) }}
            >
              <div
                className="absolute inset-y-0 left-0 bg-black"
                style={{ width: `${(pct * 100).toFixed(2)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono tabular-nums text-black/80 text-right">
              {r.display ?? format(r.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default Bars
