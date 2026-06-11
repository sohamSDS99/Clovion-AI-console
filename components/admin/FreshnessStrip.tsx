import { cn } from '@/lib/cn'

export type FreshnessState = 'green' | 'amber' | 'red'

export type FreshnessRow = {
  source: string
  lagSeconds: number
  state: FreshnessState
}

export type FreshnessStripProps = {
  rows: FreshnessRow[]
  className?: string
}

function Indicator({ state }: { state: FreshnessState }) {
  // B&W encoding: green=filled, amber=half, red=hollow (1px border).
  // No color names — purely fill/half/outline shapes.
  const base = 'inline-block w-2 h-2 border border-black'
  if (state === 'green') {
    return <span className={cn(base, 'bg-black')} aria-label="solid" />
  }
  if (state === 'amber') {
    return (
      <span
        className={base}
        aria-label="half"
        style={{
          background:
            'linear-gradient(to right, #000 0%, #000 50%, #fff 50%, #fff 100%)',
        }}
      />
    )
  }
  return <span className={cn(base, 'bg-paper')} aria-label="hollow" />
}

export function FreshnessStrip({ rows, className }: FreshnessStripProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55',
        className,
      )}
    >
      {rows.map((r) => (
        <div key={r.source} className="flex items-center gap-1.5">
          <span>{r.source}</span>
          <Indicator state={r.state} />
        </div>
      ))}
    </div>
  )
}

export default FreshnessStrip
