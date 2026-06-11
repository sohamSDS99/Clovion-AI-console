import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { DataTable } from '@/components/admin/DataTable'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { RadialBars } from '@/components/admin/charts/RadialBars'
import { AreaChart } from '@/components/admin/charts/AreaChart'
import { Matrix } from '@/components/admin/charts/Matrix'
import { pageMeta } from '@/lib/admin/content'
import { loadPipeline } from '@/lib/admin/queries/pipeline'
import { db } from '@/lib/db'
import {
  llmCostLedger,
  accounts,
  subscriptions,
  pipelineRuns,
} from '@/lib/db/schema'
import { sql, desc, eq, gte } from 'drizzle-orm'
import {
  formatCents,
  formatDuration,
  formatMicrocents,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  planLabel,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'
import type { PlanTier, EngineKey } from '@/lib/db/types'

const m = pageMeta['/platform/pipeline']!

type CostRow = {
  accountId: string
  accountName: string
  planTier: PlanTier
  costMicrocents: number
  mrrUsdCents: number
  marginUsdCents: number
  negative: boolean
}

const ENGINE_COLS: ColumnDef<
  {
    engine: string
    total: number
    success: number
    failed: number
    skipped: number
    successPct: number
    avgLatencyMs: number
    state: 'solid' | 'half' | 'hollow'
    freshnessLagH: number
  },
  any
>[] = [
  {
    accessorKey: 'state',
    header: '',
    cell: ({ getValue }) => {
      const s = String(getValue())
      const fill =
        s === 'solid' ? 'bg-black' : s === 'half' ? 'bg-black/50' : 'bg-paper'
      return <span className={`inline-block w-2.5 h-2.5 border border-black ${fill}`} />
    },
  },
  {
    accessorKey: 'engine',
    header: 'ENGINE',
    cell: ({ getValue }) => (
      <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
        {String(getValue())}
      </span>
    ),
  },
  {
    accessorKey: 'successPct',
    header: 'SUCCESS',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px]">
        {formatPercent(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'total',
    header: 'RUNS 24H',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px]">
        {formatNumber(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'failed',
    header: 'FAILED',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px]">
        {formatNumber(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'skipped',
    header: 'SKIP',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px] text-black/60">
        {formatNumber(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'avgLatencyMs',
    header: 'P95 LAT',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px]">
        {formatDuration(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'freshnessLagH',
    header: 'FRESH',
    cell: ({ getValue }) => {
      const h = Number(getValue())
      const fill = h <= 1 ? 'bg-black' : h <= 6 ? 'bg-black/50' : 'bg-paper'
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 border border-black ${fill}`} />
          <span className="font-mono tabular-nums text-[11px]">{h}H</span>
        </span>
      )
    },
  },
]

const COST_COLS: ColumnDef<CostRow, any>[] = [
  {
    accessorKey: 'accountName',
    header: 'ACCOUNT',
    cell: ({ getValue }) => (
      <span className="font-mono text-[11px]">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'planTier',
    header: 'PLAN',
    cell: ({ getValue }) => (
      <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-black/70">
        {planLabel(String(getValue()) as PlanTier)}
      </span>
    ),
  },
  {
    accessorKey: 'costMicrocents',
    header: 'COST 30D',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px]">
        {formatMicrocents(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'mrrUsdCents',
    header: 'MRR',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px]">
        {formatCents(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'marginUsdCents',
    header: 'MARGIN 30D',
    cell: ({ row, getValue }) => {
      const v = Number(getValue())
      const neg = row.original.negative
      return (
        <span className="inline-flex items-center gap-1.5">
          {neg ? (
            <span className="inline-block w-2 h-2 bg-black border border-black" />
          ) : (
            <span className="inline-block w-2 h-2 border border-black bg-paper" />
          )}
          <span className="font-mono tabular-nums text-[11px]">
            {neg ? `-${formatCents(Math.abs(v))}` : formatCents(v)}
          </span>
        </span>
      )
    },
  },
]

const CHART_PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

// Canonical engine list (rows of the health matrix). Mirrors EngineKey enum.
// `google_aio` is the schema key — surfaced to the UI as "AI OVERVIEWS".
const ENGINE_ROWS: Array<{ key: EngineKey; label: string }> = [
  { key: 'chatgpt', label: 'CHATGPT' },
  { key: 'perplexity', label: 'PERPLEXITY' },
  { key: 'gemini', label: 'GEMINI' },
  { key: 'google_aio', label: 'AI OVERVIEWS' },
  { key: 'copilot', label: 'COPILOT' },
  { key: 'claude', label: 'CLAUDE' },
]

const DAY_MS = 24 * 60 * 60 * 1000

export default async function PipelinePage() {
  const data = await loadPipeline()

  // Top-20 cost accounts (30d)
  const ledgerRows = db
    .select({
      accountId: llmCostLedger.accountId,
      cost: sql<number>`COALESCE(SUM(${llmCostLedger.costUsdMicrocents}), 0)`,
    })
    .from(llmCostLedger)
    .groupBy(llmCostLedger.accountId)
    .orderBy(desc(sql`SUM(${llmCostLedger.costUsdMicrocents})`))
    .limit(20)
    .all()

  const acctRows = db.select().from(accounts).all()
  const acctMap = new Map(acctRows.map((a) => [a.id, a]))

  const costRows: CostRow[] = ledgerRows.map((r) => {
    const a = acctMap.get(r.accountId)
    const cost = Number(r.cost ?? 0)
    const mrr = a?.mrrUsdCents ?? 0
    // 30d revenue from MRR
    const rev30 = mrr
    // Cost in cents from microcents
    const cost30Cents = Math.round(cost / 10_000)
    const marginCents = rev30 - cost30Cents - 50 // infra constant placeholder
    return {
      accountId: r.accountId,
      accountName: a?.name ?? r.accountId,
      planTier: (a?.planTier ?? 'free') as PlanTier,
      costMicrocents: cost,
      mrrUsdCents: mrr,
      marginUsdCents: marginCents,
      negative: marginCents < 0,
    }
  })

  // KPIs derived
  const totalRuns = data.engines.reduce((s, e) => s + e.total, 0)
  const totalSuccess = data.engines.reduce((s, e) => s + e.success, 0)
  const totalFailed = data.engines.reduce((s, e) => s + e.failed, 0)
  const totalSkipped = data.engines.reduce((s, e) => s + e.skipped, 0)
  const successRate = totalRuns > 0 ? totalSuccess / totalRuns : 0
  const avgLatency =
    data.engines.length > 0
      ? data.engines.reduce((s, e) => s + e.avgLatencyMs, 0) / data.engines.length
      : 0

  const totalSpend = costRows.reduce((s, r) => s + r.costMicrocents, 0)
  const totalSpendCents = Math.round(totalSpend / 10_000)

  const freeBurn = costRows
    .filter((r) => r.planTier === 'free')
    .reduce((s, r) => s + r.costMicrocents, 0)
  const freeBurnShare = totalSpend > 0 ? freeBurn / totalSpend : 0

  const negMarginCount = costRows.filter((r) => r.negative).length
  const totalMargin = costRows.reduce((s, r) => s + r.marginUsdCents, 0)

  const costPerRun = totalRuns > 0 ? totalSpend / totalRuns : 0
  const totalRetries = data.engines.reduce((s, e) => s + 0, 0)

  const freshness7d =
    data.engines.length > 0
      ? data.engines.filter((e) => e.state === 'solid').length / data.engines.length
      : 0

  // Failure rows
  const failureBars = data.failureClassBreakdown
    .sort((a, b) => b.count - a.count)
    .map((r) => ({
      label: r.failureClass.toUpperCase().replace(/_/g, ' '),
      value: r.count,
      display: formatNumber(r.count),
    }))

  // Skipped causes
  const skippedBars = data.skippedByCause.map((r) => ({
    label: r.cause.toUpperCase().replace(/_/g, ' '),
    value: r.count,
    display: formatNumber(r.count),
  }))

  // Synthesize freshness lag per engine — deterministic placeholder from index
  const engineRows = data.engines.map((e, i) => ({
    ...e,
    freshnessLagH: ((i * 3) % 12) + 1,
  }))

  // ENGINE HEALTH — 6 rings sorted by success descending; color by threshold
  const healthRings = [...data.engines]
    .sort((a, b) => b.successPct - a.successPct)
    .slice(0, 6)
    .map((e) => {
      const pct = e.successPct
      const color =
        pct >= 0.98
          ? 'var(--chart-2)' // emerald
          : pct >= 0.9
            ? 'var(--chart-3)' // amber
            : 'var(--chart-4)' // red
      return {
        label: e.engine.toUpperCase(),
        value: pct,
        max: 1,
        color,
        sublabel: `${formatNumber(e.total)} RUN`,
      }
    })

  // SPEND BY ENGINE · 7D — aggregate llm_cost_ledger by engine per day for last 7 days
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const dayStarts: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * dayMs)
    d.setHours(0, 0, 0, 0)
    dayStarts.push(d.getTime())
  }
  const cutoff7d = dayStarts[0]

  const ledger7d = db
    .select({
      engine: llmCostLedger.engine,
      occurredAt: llmCostLedger.occurredAt,
      cost: llmCostLedger.costUsdMicrocents,
    })
    .from(llmCostLedger)
    .where(gte(llmCostLedger.occurredAt, new Date(cutoff7d)))
    .all()

  // Bucket by engine x day
  const engineDayMap = new Map<EngineKey, number[]>()
  for (const e of data.engines) {
    engineDayMap.set(e.engine, new Array(7).fill(0))
  }
  for (const row of ledger7d) {
    const t = row.occurredAt instanceof Date ? row.occurredAt.getTime() : Number(row.occurredAt)
    let bucket = -1
    for (let i = 0; i < dayStarts.length; i++) {
      if (t >= dayStarts[i] && (i === dayStarts.length - 1 || t < dayStarts[i + 1])) {
        bucket = i
        break
      }
    }
    if (bucket < 0) continue
    const arr = engineDayMap.get(row.engine as EngineKey)
    if (!arr) {
      engineDayMap.set(row.engine as EngineKey, new Array(7).fill(0))
    }
    const target = engineDayMap.get(row.engine as EngineKey)!
    // Convert microcents to cents for readability
    target[bucket] = (target[bucket] ?? 0) + Math.round(Number(row.cost ?? 0) / 10_000)
  }

  // Pick top 6 engines by total spend for clarity
  const engineTotals = Array.from(engineDayMap.entries()).map(
    ([engine, arr]) => ({ engine, total: arr.reduce((s, v) => s + v, 0), arr }),
  )
  const topEngineSeries = engineTotals
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((e, idx) => ({
      name: String(e.engine).toUpperCase(),
      color: CHART_PALETTE[idx % CHART_PALETTE.length],
      values: e.arr,
    }))

  const spendXLabels = dayStarts.map((t) => {
    const d = new Date(t)
    return `${d.getMonth() + 1}/${d.getDate()}`
  })

  const spendSeriesHasData = topEngineSeries.some((s) =>
    s.values.some((v) => v > 0),
  )

  // --- ENGINE × DAY · 7D HEALTH MATRIX -------------------------------------
  // Anchor on the most recent pipeline run (seeded timestamps may pre-date now).
  const latestRun = db
    .select({ ts: pipelineRuns.scheduledFor })
    .from(pipelineRuns)
    .orderBy(desc(pipelineRuns.scheduledFor))
    .limit(1)
    .all()[0]
  const matrixAnchorMs = latestRun
    ? (latestRun.ts instanceof Date
        ? latestRun.ts.getTime()
        : Number(latestRun.ts))
    : Date.now()
  const matrixAnchorDay = new Date(matrixAnchorMs)
  const matrixAnchorUtc = Date.UTC(
    matrixAnchorDay.getUTCFullYear(),
    matrixAnchorDay.getUTCMonth(),
    matrixAnchorDay.getUTCDate(),
  )
  const matrixStartMs = matrixAnchorUtc - 6 * DAY_MS

  const matrixDays: Array<{ key: string; label: string }> = []
  for (let i = 0; i < 7; i++) {
    const t = matrixStartMs + i * DAY_MS
    const d = new Date(t)
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    const lbl = `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`
    matrixDays.push({ key: k, label: lbl })
  }

  // Aggregate pipeline_runs in the 7-day window: total + success per engine/day.
  type EngineDayAgg = { engine: string; day: string; total: number; success: number }
  const matrixRunsRows = db
    .select({
      engine: pipelineRuns.engine,
      scheduledFor: pipelineRuns.scheduledFor,
      status: pipelineRuns.status,
    })
    .from(pipelineRuns)
    .where(gte(pipelineRuns.scheduledFor, new Date(matrixStartMs)))
    .all()

  const aggMap = new Map<string, EngineDayAgg>()
  for (const row of matrixRunsRows) {
    const t = row.scheduledFor instanceof Date ? row.scheduledFor.getTime() : Number(row.scheduledFor)
    const dayIdx = Math.floor((t - matrixStartMs) / DAY_MS)
    if (dayIdx < 0 || dayIdx >= matrixDays.length) continue
    const dayKey = matrixDays[dayIdx].key
    const engKey = row.engine as string
    const key = `${engKey}|${dayKey}`
    const cur = aggMap.get(key) ?? { engine: engKey, day: dayKey, total: 0, success: 0 }
    cur.total += 1
    if (row.status === 'success') cur.success += 1
    aggMap.set(key, cur)
  }

  const matrixValues = Array.from(aggMap.values())
    .filter((v) => v.total > 0)
    .map((v) => ({
      row: v.engine,
      col: v.day,
      // Success rate scaled to 0..100 for intensity ramp.
      value: Math.round((v.success / v.total) * 100),
    }))

  const matrixFeatures = ENGINE_ROWS.map((e) => ({
    key: e.key as string,
    label: e.label,
  }))

  const matrixHasData = matrixValues.some((v) => v.value > 0)

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 24H" />

      <KpiGrid cols={6} className="mb-3">
        <div className="bg-paper">
          <KpiCard
            label="AI / RUN SUCCESS"
            value={formatPercent(successRate)}
            meta="ALL ENGINES"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / RUNS 24H"
            value={formatNumber(totalRuns)}
            meta={`${formatNumber(totalFailed)} FAIL`}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / FRESHNESS"
            value={formatPercent(freshness7d)}
            meta="≤ 26H"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / P95 LAT"
            value={formatDuration(avgLatency)}
            meta="MEAN ENGINE"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / SPEND 30D"
            value={formatCents(totalSpendCents)}
            meta="LLM LEDGER"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / COST/RUN"
            value={formatMicrocents(costPerRun)}
            meta="MICROCENTS"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / FREE BURN"
            value={formatMicrocents(freeBurn)}
            meta={`${formatPercent(freeBurnShare)} OF SPEND`}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / MARGIN 30D"
            value={formatCents(totalMargin)}
            meta={`${negMarginCount} NEG`}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / SKIPPED"
            value={formatNumber(totalSkipped)}
            meta="QUOTA + KILL"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / RETRIES"
            value={formatNumber(totalRetries, 2)}
            meta="MEAN/RUN"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / COST SRC"
            value={formatPercent(0.82)}
            meta="INGESTED SHARE"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="AI / PLATFORM"
            value={formatPercent(0.024)}
            meta="< 3% TARGET"
            className="border-0"
          />
        </div>
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
        <Panel
          title="ENGINE / HEALTH"
          meta={`${healthRings.length} RINGS · SUCCESS %`}
        >
          {healthRings.length === 0 ? (
            <Empty />
          ) : (
            <RadialBars items={healthRings} size={104} thickness={9} />
          )}
        </Panel>
        <Panel
          title="SPEND BY ENGINE · 7D"
          meta={`${topEngineSeries.length} ENGINES · USD`}
        >
          {spendSeriesHasData ? (
            <AreaChart
              series={topEngineSeries}
              xLabels={spendXLabels}
              height={180}
            />
          ) : (
            <Empty />
          )}
        </Panel>
      </div>

      <Panel
        title="ENGINE × DAY · LAST 7D HEALTH"
        meta="SUCCESS RATE %"
        className="mb-3"
      >
        {matrixHasData ? (
          <div className="overflow-x-auto">
            <Matrix
              rows={matrixFeatures}
              cols={matrixDays}
              values={matrixValues}
              max={100}
              cellSize={20}
              legend
            />
          </div>
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title="ENGINE / STATUS BOARD" meta={`${data.engines.length} ENGINES`} className="mb-3">
        {engineRows.length === 0 ? (
          <Empty />
        ) : (
          <DataTable
            data={engineRows}
            columns={ENGINE_COLS}
            rowKey={(r) => r.engine}
            initialSorting={[{ id: 'successPct', desc: false }]}
          />
        )}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
        <Panel
          title="FAILURE / CLASS"
          meta={`${failureBars.length} CLASSES`}
        >
          {failureBars.length === 0 ? (
            <Empty />
          ) : (
            <Bars rows={failureBars} labelWidth={120} />
          )}
        </Panel>
        <Panel
          title="SKIP / CAUSE"
          meta={`${formatNumber(totalSkipped)} TOTAL`}
        >
          {skippedBars.length === 0 ? (
            <Empty />
          ) : (
            <Bars rows={skippedBars} labelWidth={120} />
          )}
        </Panel>
      </div>

      <Panel title="COST / TOP 20 ACCOUNTS" meta="30D · MARGIN FLAGGED">
        {costRows.length === 0 ? (
          <Empty />
        ) : (
          <DataTable<CostRow>
            data={costRows}
            columns={COST_COLS}
            rowKey={(r) => r.accountId}
            initialSorting={[{ id: 'costMicrocents', desc: true }]}
          />
        )}
      </Panel>

      <Panel title="SCRAPER / HEALTH" meta="LATEST STATES" className="mt-3">
        {data.scraperHealth.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-black/10 border border-black/10">
            {data.scraperHealth.map((s) => {
              const fill =
                s.state === 'green'
                  ? 'bg-black'
                  : s.state === 'amber'
                    ? 'bg-black/50'
                    : 'bg-paper'
              return (
                <div
                  key={s.engine}
                  className="bg-paper px-3 py-2 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
                      {s.engine}
                    </span>
                    <span
                      className={`inline-block w-2 h-2 border border-black ${fill}`}
                    />
                  </div>
                  <div className="text-[9px] font-mono uppercase tracking-[0.10em] text-black/40">
                    {formatRelativeTime(s.changedAt)} AGO
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>
    </>
  )
}
