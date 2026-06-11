import { cn } from '@/lib/cn'

export type FunnelStep = {
  name: string
  entered: number
  completed: number
  conversionPct?: number
  medianHoursToStep?: number
}

export type FunnelProps = {
  steps: FunnelStep[]
  className?: string
  labelWidth?: number
}

export function Funnel({ steps, className, labelWidth = 200 }: FunnelProps) {
  if (steps.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }
  const first = steps[0].entered || 1

  return (
    <div className={cn('flex flex-col', className)} style={{ rowGap: 4 }}>
      {steps.map((s, i) => {
        const widthPct = Math.max(0, Math.min(1, s.entered / first))
        const conv = s.conversionPct ?? (s.entered > 0 ? (s.completed / s.entered) * 100 : 0)
        return (
          <div
            key={`${s.name}-${i}`}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: `${labelWidth}px 1fr auto`, minHeight: 22 }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9.5px] font-mono tabular-nums text-black/40 w-5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[10px] uppercase tracking-[0.12em] truncate">
                {s.name}
              </span>
            </div>
            <div className="relative bg-black/5" style={{ height: 16 }}>
              <div
                className="absolute inset-y-0 left-0 bg-black"
                style={{ width: `${(widthPct * 100).toFixed(2)}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums shrink-0">
              <span className="text-black/70">
                {s.entered.toLocaleString('en-US')}
                <span className="text-black/30 px-1">{'→'}</span>
                {s.completed.toLocaleString('en-US')}
              </span>
              <span className="text-black/90 w-12 text-right">{conv.toFixed(1)}%</span>
              {typeof s.medianHoursToStep === 'number' ? (
                <span className="text-black/40 w-14 text-right">
                  {s.medianHoursToStep.toFixed(1)}h
                </span>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Funnel
