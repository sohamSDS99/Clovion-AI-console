import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { Bars } from '@/components/admin/Bars'
import { Sparkline } from '@/components/admin/Sparkline'
import { Empty } from '@/components/admin/Empty'
import { Gauge } from '@/components/admin/charts/Gauge'
import { pageMeta } from '@/lib/admin/content'
import { loadPerformance } from '@/lib/admin/queries/performance'
import {
  formatNumber,
  formatPercent,
  formatDuration,
  formatRelativeTime,
  formatBenchmark,
} from '@/lib/admin/format'
import { metricByKey } from '@/lib/admin/metrics'
import { paletteAt } from '@/lib/admin/palette'

const m = pageMeta['/platform/performance']!

function last(series: Array<{ value: number }>): number {
  return series.length > 0 ? series[series.length - 1].value : 0
}

function avg(series: Array<{ value: number }>, n: number): number {
  if (series.length === 0) return 0
  const tail = series.slice(-n)
  return tail.reduce((s, p) => s + p.value, 0) / tail.length
}

function values(series: Array<{ value: number }>, n = 28): number[] {
  return series.slice(-n).map((p) => p.value)
}

function deltaPctVs(curr: number, prevAvg: number): {
  pct: number
  dir: 'up' | 'down' | 'flat'
} {
  if (!prevAvg) return { pct: 0, dir: 'flat' }
  const d = (curr - prevAvg) / Math.abs(prevAvg)
  return {
    pct: Math.abs(d * 100),
    dir: Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down',
  }
}

function benchmarkMeta(key: string): string | undefined {
  const m = metricByKey(key)
  if (!m?.benchmark) return undefined
  return formatBenchmark(m.benchmark)
}

export default async function PerformancePage() {
  const d = await loadPerformance()

  const lcpNow = last(d.lcpSeries)
  const inpNow = last(d.inpSeries)
  const clsNow = last(d.clsSeries)
  const p50Now = last(d.apiP50Series)
  const p95Now = last(d.apiP95Series)
  const p99Now = last(d.apiP99Series)
  const errNow = last(d.errorRateSeries)
  const upNow = last(d.uptimeSeries)

  const lcpPrev = avg(d.lcpSeries.slice(0, -1), 7)
  const inpPrev = avg(d.inpSeries.slice(0, -1), 7)
  const clsPrev = avg(d.clsSeries.slice(0, -1), 7)
  const p95Prev = avg(d.apiP95Series.slice(0, -1), 7)
  const p99Prev = avg(d.apiP99Series.slice(0, -1), 7)
  const errPrev = avg(d.errorRateSeries.slice(0, -1), 7)

  const errorBudget = 0.001
  const burn = errorBudget > 0 ? (1 - d.sloAvailability28d) / errorBudget : 0

  // --- SLO gauges -----------------------------------------------------------
  // Uptime SLO over last 7d (vs 99.9% target).
  const uptime7d = avg(d.uptimeSeries, 7)
  // API p95 SLO: budget remaining = max(0, 1 - currentP95 / target). Target = 500ms (standard).
  const apiP95Ms = Math.round(p95Now)
  const apiP95Target = 500
  const apiP95Budget = Math.max(0, Math.min(1, 1 - apiP95Ms / apiP95Target))

  // Per-row palette colors so the three stacked Sparklines in each panel render
  // as distinct series (LCP/INP/CLS and P50/P95/P99).
  const cwvColors = [paletteAt(0), paletteAt(1), paletteAt(2)] as const
  const apiColors = [paletteAt(5), paletteAt(6), paletteAt(7)] as const

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 28D · 4 GOLDEN SIGNALS" />

      {/* SLOs — added above existing content */}
      <Panel title="SLOS" meta="ROLLING TARGETS" className="mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 justify-items-center">
          <Gauge
            label="UPTIME SLO"
            value={uptime7d}
            max={1}
            target={0.999}
            valueLabel={`${(uptime7d * 100).toFixed(2)}%`}
            metaLabel="target 99.9%"
            color="var(--chart-2)"
          />
          <Gauge
            label="API P95 SLO"
            value={apiP95Budget}
            max={1}
            target={0.95}
            valueLabel={`${apiP95Ms}ms`}
            metaLabel="budget remaining"
            color="var(--chart-1)"
          />
        </div>
      </Panel>

      <KpiGrid cols={8} className="mb-3">
        <KpiCard
          label="LCP P75"
          value={formatDuration(lcpNow)}
          delta={deltaPctVs(lcpNow, lcpPrev)}
          spark={values(d.lcpSeries)}
          meta={benchmarkMeta('perf.lcp')}
        />
        <KpiCard
          label="INP P75"
          value={formatDuration(inpNow)}
          delta={deltaPctVs(inpNow, inpPrev)}
          spark={values(d.inpSeries)}
          meta={benchmarkMeta('perf.inp')}
        />
        <KpiCard
          label="CLS P75"
          value={clsNow.toFixed(3)}
          delta={deltaPctVs(clsNow, clsPrev)}
          spark={values(d.clsSeries)}
          meta={benchmarkMeta('perf.cls')}
        />
        <KpiCard
          label="API P50"
          value={formatDuration(p50Now)}
          spark={values(d.apiP50Series)}
        />
        <KpiCard
          label="API P95"
          value={formatDuration(p95Now)}
          delta={deltaPctVs(p95Now, p95Prev)}
          spark={values(d.apiP95Series)}
          meta="≤500MS"
        />
        <KpiCard
          label="API P99"
          value={formatDuration(p99Now)}
          delta={deltaPctVs(p99Now, p99Prev)}
          spark={values(d.apiP99Series)}
          meta="≤1.5S"
        />
        <KpiCard
          label="ERROR RATE"
          value={formatPercent(errNow * 100, undefined, 2)}
          delta={deltaPctVs(errNow, errPrev)}
          spark={values(d.errorRateSeries)}
        />
        <KpiCard
          label="UPTIME 28D"
          value={formatPercent(upNow * 100, undefined, 3)}
          spark={values(d.uptimeSeries)}
          meta="≥99.9%"
        />
        <KpiCard
          label="SLO AVAIL 28D"
          value={formatPercent(d.sloAvailability28d * 100, undefined, 3)}
          meta="TARGET 99.9%"
        />
        <KpiCard
          label="SLO LAT 28D"
          value={formatPercent(d.sloLatency28d * 100, undefined, 2)}
          meta="P90/P99"
        />
        <KpiCard
          label="BUDGET BURN"
          value={`${burn.toFixed(2)}x`}
          meta={burn >= 2 ? 'PAGE' : burn >= 1 ? 'ALERT' : 'OK'}
        />
        <KpiCard
          label="QUEUE DEPTH"
          value={formatNumber(d.queue.depth)}
        />
        <KpiCard
          label="QUEUE AGE"
          value={formatDuration(d.queue.oldestAgeMs)}
          meta="OLDEST JOB"
        />
        <KpiCard
          label="QUEUE FAILS 24H"
          value={formatNumber(d.queue.fails24h)}
        />
        <KpiCard
          label="CRASH-FREE"
          value={formatPercent(99.94, undefined, 2)}
          meta="SESSIONS"
        />
        <KpiCard
          label="SATURATION"
          value={formatPercent(48, undefined, 0)}
          meta="DB CPU"
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Panel title="CORE WEB VITALS · P75 · 28D" meta="WEB.DEV">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">LCP</span>
              <Sparkline values={values(d.lcpSeries)} width={320} height={28} color={cwvColors[0]} label="LCP" />
              <span className="font-mono tabular-nums text-[11px]">{formatDuration(lcpNow)}</span>
            </div>
            <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">INP</span>
              <Sparkline values={values(d.inpSeries)} width={320} height={28} color={cwvColors[1]} label="INP" />
              <span className="font-mono tabular-nums text-[11px]">{formatDuration(inpNow)}</span>
            </div>
            <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">CLS</span>
              <Sparkline values={values(d.clsSeries)} width={320} height={28} color={cwvColors[2]} label="CLS" />
              <span className="font-mono tabular-nums text-[11px]">{clsNow.toFixed(3)}</span>
            </div>
          </div>
        </Panel>

        <Panel title="API LATENCY · MULTI-PERCENTILE · 28D" meta="GRAFANA">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">P50</span>
              <Sparkline values={values(d.apiP50Series)} width={320} height={28} color={apiColors[0]} label="P50" />
              <span className="font-mono tabular-nums text-[11px]">{formatDuration(p50Now)}</span>
            </div>
            <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">P95</span>
              <Sparkline values={values(d.apiP95Series)} width={320} height={28} color={apiColors[1]} label="P95" />
              <span className="font-mono tabular-nums text-[11px]">{formatDuration(p95Now)}</span>
            </div>
            <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">P99</span>
              <Sparkline values={values(d.apiP99Series)} width={320} height={28} color={apiColors[2]} label="P99" />
              <span className="font-mono tabular-nums text-[11px]">{formatDuration(p99Now)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Panel title="SLO BUDGET BURN · 28D" meta="SRE WORKBOOK">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">AVAILABILITY</span>
              <div className="relative bg-black/5 h-3">
                <div
                  className="absolute inset-y-0 left-0 bg-black"
                  style={{ width: `${Math.min(100, d.sloAvailability28d * 100).toFixed(2)}%` }}
                />
                <div
                  className="absolute inset-y-0 border-l border-black/40"
                  style={{ left: '99.9%' }}
                />
              </div>
              <span className="font-mono tabular-nums text-[11px]">
                {formatPercent(d.sloAvailability28d * 100, undefined, 3)}
              </span>
            </div>
            <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">LATENCY</span>
              <div className="relative bg-black/5 h-3">
                <div
                  className="absolute inset-y-0 left-0 bg-black"
                  style={{ width: `${Math.min(100, d.sloLatency28d * 100).toFixed(2)}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-[11px]">
                {formatPercent(d.sloLatency28d * 100, undefined, 2)}
              </span>
            </div>
            <div className="grid grid-cols-[120px_1fr_auto] items-center gap-3 mt-2 pt-2 border-t border-black/10">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">BURN RATE</span>
              <div className="relative bg-black/5 h-3">
                <div
                  className="absolute inset-y-0 left-0 bg-black"
                  style={{ width: `${Math.min(100, (burn / 4) * 100).toFixed(2)}%` }}
                />
                <div className="absolute inset-y-0 border-l border-black/40" style={{ left: '25%' }} />
                <div className="absolute inset-y-0 border-l border-black/40" style={{ left: '50%' }} />
              </div>
              <span className="font-mono tabular-nums text-[11px]">{burn.toFixed(2)}x</span>
            </div>
            <div className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45 mt-2">
              ERROR BUDGET 0.1% · 28D ROLLING · BURN ≥1 ALERT · ≥2 PAGE
            </div>
          </div>
        </Panel>

        <Panel title="ERROR RATE · 28D" meta="RATIO SLI">
          {d.errorRateSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <span className="font-mono tabular-nums text-[18px] font-semibold">
                  {formatPercent(errNow * 100, undefined, 3)}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45">
                  NON-5XX ÷ TOTAL
                </span>
              </div>
              <Sparkline values={values(d.errorRateSeries)} width={420} height={48} color={paletteAt(3)} label="ERROR" />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Panel title="QUEUE HEALTH" meta="REALTIME">
          <Bars
            rows={[
              { label: 'DEPTH', value: d.queue.depth, max: 100, display: formatNumber(d.queue.depth) },
              {
                label: 'OLDEST AGE',
                value: d.queue.oldestAgeMs / 1000,
                max: 300,
                display: formatDuration(d.queue.oldestAgeMs),
              },
              {
                label: 'FAILS 24H',
                value: d.queue.fails24h,
                max: 20,
                display: formatNumber(d.queue.fails24h),
              },
            ]}
            labelWidth={100}
          />
        </Panel>

        <Panel title="UPTIME · 28D" meta="BETTER STACK">
          {d.uptimeSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <span className="font-mono tabular-nums text-[18px] font-semibold">
                  {formatPercent(upNow * 100, undefined, 3)}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45">
                  TARGET 99.9%
                </span>
              </div>
              <Sparkline values={values(d.uptimeSeries)} width={420} height={48} color={paletteAt(1)} label="UPTIME" />
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
