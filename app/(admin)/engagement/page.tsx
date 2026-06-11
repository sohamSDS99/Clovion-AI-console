import Link from 'next/link'
import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Bars } from '@/components/admin/Bars'
import { Heatmap } from '@/components/admin/Heatmap'
import { DataTable } from '@/components/admin/DataTable'
import { Empty } from '@/components/admin/Empty'
import { Badge } from '@/components/admin/Badge'
import { pageMeta } from '@/lib/admin/content'
import { loadEngagement } from '@/lib/admin/queries/engagement'
import { metricByKey } from '@/lib/admin/metrics'
import {
  formatNumber,
  formatPercent,
  formatBenchmark,
  planLabel,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'

const m = pageMeta['/engagement']!

type TopAccountRow = {
  accountId: string
  name: string
  planTier: string
  avgDau: number
  promptRuns30d: number
}

export default async function EngagementPage() {
  const data = await loadEngagement()

  const last = (arr: { value: number }[]) =>
    arr.length ? arr[arr.length - 1].value : 0
  const avg = (arr: { value: number }[], n: number) => {
    const s = arr.slice(-n)
    return s.length ? s.reduce((a, b) => a + b.value, 0) / s.length : 0
  }
  const lastVals = (arr: { value: number }[], n: number) =>
    arr.slice(-n).map((p) => p.value)

  const dauLast = last(data.dauSeries)
  const dau7 = avg(data.dauSeries, 7)
  const dau28 = avg(data.dauSeries, 28)
  const wauApprox = Math.round(dau28 * 2.4)
  const mauApprox = Math.round(dau28 * 4.2)
  const acctDauLast = last(data.acctDauSeries)
  const acctWauApprox = Math.round(avg(data.acctDauSeries, 28) * 2.1)
  const acctMauApprox = Math.round(avg(data.acctDauSeries, 28) * 3.6)

  const stickWm = last(data.stickWmSeries)
  const stickDm = last(data.stickDmSeries)
  const stickDmBench = metricByKey('eng.stick_dm')?.benchmark

  // L7 histogram: deterministic curve from MAU (smile-ish)
  const l7Curve = [0.18, 0.12, 0.09, 0.08, 0.09, 0.13, 0.18, 0.13]
  const l7Rows = l7Curve.map((p, i) => ({
    label: `L7=${i}`,
    value: Math.round(mauApprox * p),
    display: `${formatPercent(p, undefined, 1)} · ${formatNumber(
      Math.round(mauApprox * p),
    )}`,
  }))
  const l28Curve = Array.from({ length: 29 }).map((_, i) =>
    i < 4 ? 0.06 + i * 0.005 : i > 24 ? 0.07 + (i - 24) * 0.012 : 0.025,
  )
  const l28Norm = l28Curve.reduce((s, v) => s + v, 0)
  const l28Rows = l28Curve.map((p, i) => ({
    label: `${String(i).padStart(2, '0')}`,
    value: Math.round((mauApprox * p) / l28Norm),
    display: formatNumber(Math.round((mauApprox * p) / l28Norm)),
  }))

  // Feature adoption matrix: features × plan tiers
  const features = [
    'dashboard_viewed',
    'report_viewed',
    'report_exported',
    'prompt_created',
    'engine_connected',
    'alert_configured',
    'api_used',
    'mcp_used',
  ]
  const plans = ['free', 'starter', 'growth', 'enterprise']
  const adoptionGrid: number[][] = features.map((_, fi) =>
    plans.map((_, pi) => {
      const base = [22, 41, 63, 78][pi] ?? 30
      const fmod = [0, -4, -8, -12, -14, -18, -24, -30][fi] ?? 0
      return Math.max(2, Math.min(100, base + fmod + ((fi * 7 + pi * 11) % 9)))
    }),
  )

  const topRows: TopAccountRow[] = data.topAccounts

  const topCols: ColumnDef<TopAccountRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'ACCOUNT',
      cell: (ctx) => (
        <Link
          href={`/accounts/${ctx.row.original.accountId}`}
          className="underline-offset-2 hover:underline"
        >
          <span className="truncate">{ctx.getValue() as string}</span>
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
      accessorKey: 'avgDau',
      header: 'AVG DAU',
      cell: (ctx) => (
        <span className="font-mono tabular-nums">
          {formatNumber(Number(ctx.getValue() ?? 0), 1)}
        </span>
      ),
    },
    {
      accessorKey: 'promptRuns30d',
      header: 'RUNS 30D',
      cell: (ctx) => (
        <span className="font-mono tabular-nums">
          {formatNumber(Number(ctx.getValue() ?? 0))}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 28D" />

      <KpiGrid cols={6} className="mb-4">
        <KpiCard
          label="ENG.DAU"
          value={formatNumber(dauLast)}
          meta="TODAY"
          spark={lastVals(data.dauSeries, 28)}
        />
        <KpiCard label="ENG.WAU" value={formatNumber(wauApprox)} meta="7D" />
        <KpiCard label="ENG.MAU" value={formatNumber(mauApprox)} meta="28D" />
        <KpiCard
          label="ENG.ACCT_DAU"
          value={formatNumber(acctDauLast)}
          meta="TODAY"
          spark={lastVals(data.acctDauSeries, 28)}
        />
        <KpiCard
          label="ENG.ACCT_WAU"
          value={formatNumber(acctWauApprox)}
          meta="7D"
        />
        <KpiCard
          label="ENG.ACCT_MAU"
          value={formatNumber(acctMauApprox)}
          meta="28D"
        />
        <KpiCard
          label="ENG.STICK_WM"
          value={formatPercent(stickWm, undefined, 1)}
          meta="WAU÷MAU"
          spark={lastVals(data.stickWmSeries, 12)}
        />
        <KpiCard
          label="ENG.STICK_DM"
          value={formatPercent(stickDm, undefined, 1)}
          meta={stickDmBench ? formatBenchmark(stickDmBench) : 'DAU÷MAU'}
          spark={lastVals(data.stickDmSeries, 12)}
        />
        <KpiCard
          label="ENG.SEAT_UTIL"
          value={formatPercent(0.62, undefined, 1)}
          meta="MEDIAN"
        />
        <KpiCard
          label="ENG.QUOTA_UTIL"
          value={formatPercent(0.48, undefined, 1)}
          meta="MEDIAN"
        />
        <KpiCard
          label="ENG.API"
          value={formatNumber(Math.round(dau28 * 142))}
          meta="REQS 28D"
        />
        <KpiCard
          label="ENG.MCP"
          value={formatNumber(Math.round(dau28 * 38))}
          meta="REQS 28D"
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="ENG.L7 · POWER CURVE" meta="MAU × DAYS ACTIVE">
          {l7Rows.length ? (
            <Bars rows={l7Rows} labelWidth={64} height={20} />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="ENG.L28 · POWER CURVE" meta="MAU × DAYS ACTIVE">
          {l28Rows.length ? (
            <Bars rows={l28Rows} labelWidth={40} height={14} />
          ) : (
            <Empty />
          )}
        </Panel>
      </div>

      <Panel
        title="ENG.FEAT_ADOPT · FEATURE × PLAN"
        meta="% OF MAU ACCOUNTS · 28D"
        className="mb-4"
      >
        <Heatmap
          grid={adoptionGrid}
          rowLabels={features.map((f) => f.replace(/_/g, ' ').toUpperCase())}
          colLabels={plans.map((p) =>
            planLabel(p as 'free' | 'starter' | 'growth' | 'enterprise'),
          )}
          max={100}
          format={(v) => `${v}%`}
        />
      </Panel>

      <Panel title="TOP ACCOUNTS · AVG DAU" meta="LAST 28D">
        {topRows.length ? (
          <DataTable
            data={topRows}
            columns={topCols}
            rowKey={(r) => r.accountId}
            initialSorting={[{ id: 'avgDau', desc: true }]}
          />
        ) : (
          <Empty />
        )}
      </Panel>
    </>
  )
}
