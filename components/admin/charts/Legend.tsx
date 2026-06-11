import { cn } from '@/lib/cn'

export type LegendItem = {
  label: string
  color: string
  value?: string
}

export type ChartLegendProps = {
  items: LegendItem[]
  className?: string
  swatchSize?: number
  align?: 'start' | 'center' | 'end'
  layout?: 'row' | 'col'
}

export function ChartLegend({
  items,
  className,
  swatchSize = 8,
  align = 'start',
  layout = 'row',
}: ChartLegendProps) {
  const alignClass =
    align === 'center'
      ? 'justify-center'
      : align === 'end'
        ? 'justify-end'
        : 'justify-start'
  return (
    <div
      className={cn(
        'flex gap-x-4 gap-y-1 text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/70',
        layout === 'row' ? 'flex-row flex-wrap items-center' : 'flex-col items-start',
        alignClass,
        className,
      )}
    >
      {items.map((it, i) => (
        <div
          key={`${it.label}-${i}`}
          className="flex items-center gap-1.5 leading-none"
        >
          <span
            aria-hidden="true"
            style={{
              width: swatchSize,
              height: swatchSize,
              background: it.color,
              display: 'inline-block',
            }}
          />
          <span>{it.label}</span>
          {it.value ? (
            <span className="tabular-nums text-black/55">{it.value}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default ChartLegend
