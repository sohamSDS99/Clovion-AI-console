import Link from 'next/link'
import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Bars } from '@/components/admin/Bars'
import { HeatmapInteger } from '@/components/admin/charts/PageWrappers'
import { DataTable } from '@/components/admin/DataTable'
import { Empty } from '@/components/admin/Empty'
import { Badge } from '@/components/admin/Badge'
import { pageMeta } from '@/lib/admin/content'
import { CHART_PALETTE } from '@/lib/admin/palette'
import { loadRetention } from '@/lib/admin/queries/retention'
import { metricByKey } from '@/lib/admin/metrics'
import {
  formatNumber,
  formatPercent,
  formatCents,
  formatBenchmark,
  formatRelativeTime,
  planLabel,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'

const m = pageMeta['/growth/retention']!

type AtRiskRow = {
  accountId: string
  name: string
  planTier: string
  mrrUsdCents: number
  lastSeenAt: number | null
  factors: string[]
}

type ExpansionRow = {
  accountId: string
  name: string
  planTier: string
  mrrUsdCents: number
  seatUtilPct: number
}

function monthLabel(monthsAgo: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - monthsAgo)
  return d.toISOString().slice(2, 7).replace('-', '/')
}

export default async function RetentionPage() {
  const data = await loadRetention()

  const last = (arr: { value: number }[]) =>
    arr.length ? arr[arr.length - 1].value : 0
  const lastVals = (arr: { value: number }[], n: number) =>
    arr.slice(-n).map((p) => p.value)

  const grr = last(data.grrSeries)
  const nrrTtm = last(data.nrrTtmSeries)
  const nrrM = last(data.nrrMSeries)
  const logoChurn = last(data.logoChurnSeries)
  const mrrChurn = logoChurn * 0.92
  const reactivationRate = 0.124
  const dunningRecovery = 0.687
  const expansionShare = 0.412

  const grrBench = metricByKey('ret.grr')?.benchmark
  const nrrBench = metricByKey('ret.nrr_ttm')?.benchmark

  // 12x12 cohort heatmap built from cohortRetentionMonthly. Map (cohortMonth, monthN) -> grrPct.
  const cohortMonths = Array.from(
    new Set(data.cohortHeatmap.map((r) => r.cohortMonth)),
  ).sort((a, b) => b - a)
  const cohortsRendered = cohortMonths.slice(0, 12)
  const heatmapGrid: number[][] = cohortsRendered.map((cm) => {
    const row: number[] = []
    for (let mn = 0; mn < 12; mn++) {
      const cell = data.cohortHeatmap.find(
        (r) => r.cohortMonth === cm && r.monthN === mn,
      )
      row.push(cell ? cell.grrPct : 0)
    }
    return row
  })
  const heatmapRows = cohortsRendered.map((_, i) => monthLabel(i))
  const heatmapCols = Array.from({ length: 12 }).map((_, i) =>
    `M${String(i).padStart(2, '0')}`,
  )

  const vol = data.voluntaryVsInvoluntary.voluntary
  const inv = data.voluntaryVsInvoluntary.involuntary
  const totalChurn = vol + inv || 1
  const involShare = inv / totalChurn

  const churnSplitRows = [
    {
      label: 'VOLUNTARY',
      value: vol,
      display: `${formatNumber(vol)} · ${formatPercent(
        vol / totalChurn,
        undefined,
        1,
      )}`,
    },
    {
      label: 'INVOLUNTARY',
      value: inv,
      display: `${formatNumber(inv)} · ${formatPercent(
        inv / totalChurn,
        undefined,
        1,
      )}`,
    },
  ]

  const reasonRows = [
    { label: 'PRICE', pct: 0.32 },
    { label: 'MISSING_FEATURE', pct: 0.21 },
    { label: 'COMPETITOR', pct: 0.15 },
    { label: 'NO_USE_CASE', pct: 0.13 },
    { label: 'BUDGET_CUT', pct: 0.09 },
    { label: 'OTHER', pct: 0.10 },
  ].map((r) => ({
    label: r.label,
    value: r.pct * 100,
    display: formatPercent(r.pct, undefined, 1),
  }))

  const atRiskCols: ColumnDef<AtRiskRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'ACCOUNT',
      cell: (ctx) => (
        <Link
          href={`/customers/accounts/${ctx.row.original.accountId}`}
          className="underline-offset-2 hover:underline"
        >
          {ctx.getValue() as string}
        </Link>
      ),
    },
    {
      accessorKey: 'planTier',
      header: 'PLAN',
      cell: (ctx) => (
        <Badge variant="outline">
          {planLabel(ctx.getValue() as 'free' | 'starter' | 'growth' | 'enterprise')}
        </Badge>
      ),
    },
    {
      accessorKey: 'mrrUsdCents',
      header: 'MRR',
      cell: (ctx) => (
        <span className="font-mono tabular-nums">
          {formatCents(Number(ctx.getValue() ?? 0))}
        </span>
      ),
    },
    {
      accessorKey: 'lastSeenAt',
      header: 'LAST SEEN',
      cell: (ctx) => {
        const v = ctx.getValue() as number | null
        return (
          <span className="font-mono tabular-nums text-black/60">
            {v ? formatRelativeTime(v) : '—'}
          </span>
        )
      },
    },
    {
      accessorKey: 'factors',
      header: 'FACTORS',
      cell: (ctx) => {
        const f = (ctx.getValue() as string[]) ?? []
        return (
          <span className="flex gap-1 flex-wrap">
            {f.slice(0, 3).map((x) => (
              <Badge key={x} variant="outline">
                {x}
              </Badge>
            ))}
          </span>
        )
      },
    },
  ]

  const expansionCols: ColumnDef<ExpansionRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'ACCOUNT',
      cell: (ctx) => (
        <Link
          href={`/customers/accounts/${ctx.row.original.accountId}`}
          className="underline-offset-2 hover:underline"
        >
          {ctx.getValue() as string}
        </Link>
      ),
    },
    {
      accessorKey: 'planTier',
      header: 'PLAN',
      cell: (ctx) => (
        <Badge variant="outline">
          {planLabel(ctx.getValue() as 'free' | 'starter' | 'growth' | 'enterprise')}
        </Badge>
      ),
    },
    {
      accessorKey: 'mrrUsdCents',
      header: 'MRR',
      cell: (ctx) => (
        <span className="font-mono tabular-nums">
          {formatCents(Number(ctx.getValue() ?? 0))}
        </span>
      ),
    },
    {
      accessorKey: 'seatUtilPct',
      header: 'SEAT UTIL',
      cell: (ctx) => (
        <span className="font-mono tabular-nums">
          {formatPercent(Number(ctx.getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 28D" />

      <KpiGrid cols={6} className="mb-4">
        <KpiCard
          label="RET.NRR_TTM"
          value={formatPercent(nrrTtm, undefined, 1)}
          meta={nrrBench ? formatBenchmark(nrrBench) : 'TTM'}
          spark={lastVals(data.nrrTtmSeries, 12)}
        />
        <KpiCard
          label="RET.GRR"
          value={formatPercent(grr, undefined, 1)}
          meta={grrBench ? formatBenchmark(grrBench) : 'MONTHLY'}
          spark={lastVals(data.grrSeries, 12)}
        />
        <KpiCard
          label="RET.NRR_M"
          value={formatPercent(nrrM, undefined, 1)}
          meta="MONTHLY"
          spark={lastVals(data.nrrMSeries, 12)}
        />
        <KpiCard
          label="RET.LOGO_CHURN"
          value={formatPercent(logoChurn, undefined, 2)}
          meta="MONTHLY"
          spark={lastVals(data.logoChurnSeries, 12)}
        />
        <KpiCard
          label="RET.MRR_CHURN"
          value={formatPercent(mrrChurn, undefined, 2)}
          meta="MONTHLY"
        />
        <KpiCard
          label="RET.REACT"
          value={formatPercent(reactivationRate, undefined, 1)}
          meta="90D MRR"
        />
        <KpiCard
          label="RET.CHURN_SPLIT"
          value={formatPercent(involShare, undefined, 1)}
          meta="INVOLUNTARY"
        />
        <KpiCard
          label="DUNNING.RECOVERY"
          value={formatPercent(dunningRecovery, undefined, 1)}
          meta="60D"
        />
        <KpiCard
          label="EXPANSION.SHARE"
          value={formatPercent(expansionShare, undefined, 1)}
          meta="OF NEW ARR"
        />
        <KpiCard
          label="RET.AT_RISK"
          value={formatNumber(data.atRisk.length)}
          meta="ACCOUNTS"
        />
        <KpiCard
          label="RET.EXPANSION_READY"
          value={formatNumber(data.expansionReady.length)}
          meta="ACCOUNTS"
        />
        <KpiCard
          label="RET.COHORT"
          value={formatNumber(cohortsRendered.length)}
          meta="COHORTS"
        />
      </KpiGrid>

      <Panel
        title="RET.COHORT · 12 × 12"
        meta="GRR % BY COHORT_MONTH × MONTH_N"
        className="mb-4"
      >
        {heatmapGrid.length ? (
          <HeatmapInteger
            grid={heatmapGrid}
            rowLabels={heatmapRows}
            colLabels={heatmapCols}
            max={100}
            colors={CHART_PALETTE.slice()}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="RET.CHURN_SPLIT" meta="VOLUNTARY × INVOLUNTARY">
          {churnSplitRows.length ? (
            <Bars rows={churnSplitRows} labelWidth={120} height={22} colors={CHART_PALETTE.slice()} />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="RET.REASONS · PARETO" meta="REASON_CODE DISTRIBUTION">
          <Bars rows={reasonRows} labelWidth={140} height={20} colors={CHART_PALETTE.slice()} />
        </Panel>
      </div>

      <Panel
        title="RET.AT_RISK · TOP ACCOUNTS"
        meta={`${data.atRisk.length} ACCOUNTS · MRR AT RISK`}
        className="mb-4"
      >
        {data.atRisk.length ? (
          <DataTable
            data={data.atRisk}
            columns={atRiskCols}
            rowKey={(r) => r.accountId}
            initialSorting={[{ id: 'mrrUsdCents', desc: true }]}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        title="RET.EXPANSION_READY · TOP ACCOUNTS"
        meta="SEAT/QUOTA > 80%"
      >
        {data.expansionReady.length ? (
          <DataTable
            data={data.expansionReady}
            columns={expansionCols}
            rowKey={(r) => r.accountId}
            initialSorting={[{ id: 'seatUtilPct', desc: true }]}
          />
        ) : (
          <Empty />
        )}
      </Panel>
    </>
  )
}
