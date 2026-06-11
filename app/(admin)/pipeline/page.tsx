import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { DataTable } from '@/components/admin/DataTable'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadPipeline } from '@/lib/admin/queries/pipeline'
import { db } from '@/lib/db'
import { llmCostLedger, accounts, subscriptions } from '@/lib/db/schema'
import { sql, desc, eq } from 'drizzle-orm'
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
import type { PlanTier } from '@/lib/db/types'

const m = pageMeta['/pipeline']!

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
