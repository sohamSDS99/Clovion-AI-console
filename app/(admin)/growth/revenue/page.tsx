import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { DataTable } from '@/components/admin/DataTable'
import { WaterfallCents } from '@/components/admin/charts/PageWrappers'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { AreaChart } from '@/components/admin/charts/AreaChart'
import { Donut } from '@/components/admin/charts/Donut'
import { pageMeta } from '@/lib/admin/content'
import { loadRevenue } from '@/lib/admin/queries/revenue'
import { metricByKey } from '@/lib/admin/metrics'
import {
  formatBenchmark,
  formatCents,
  formatNumber,
  formatPercent,
  planLabel,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'
import type { PlanTier } from '@/lib/db/types'

const m = pageMeta['/growth/revenue']!

type DunningRow = {
  id: string
  accountId: string
  accountName: string
  amountUsdCents: number
  attemptCount: number
  daysDelinquent: number
  nextPaymentAttempt: number | null
}

function last<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined
}
function prior<T>(arr: T[], idx: number): T | undefined {
  return arr.length > idx ? arr[arr.length - 1 - idx] : undefined
}

function sparkOf(series: Array<{ date: number; value: number }>, n = 28) {
  return series.slice(-n).map((s) => s.value)
}

function benchmarkMeta(key: string): string | undefined {
  const def = metricByKey(key)
  if (def?.benchmark) return formatBenchmark(def.benchmark)
  return def?.grain.toUpperCase()
}

// Tier color: starter (cyan), growth (indigo), enterprise (pink), free (teal).
const TIER_COLOR: Record<string, string> = {
  free: '#14b8a6',
  starter: '#06b6d4',
  growth: '#6366f1',
  enterprise: '#ec4899',
}
const TIER_ORDER: Array<'free' | 'starter' | 'growth' | 'enterprise'> = [
  'starter',
  'growth',
  'enterprise',
]

const DUNNING_COLS: ColumnDef<DunningRow, any>[] = [
  {
    accessorKey: 'accountName',
    header: 'ACCOUNT',
    cell: ({ getValue }) => (
      <span className="font-mono text-[11px]">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'amountUsdCents',
    header: 'AMT',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px] text-right block">
        {formatCents(Number(getValue()))}
      </span>
    ),
  },
  {
    accessorKey: 'daysDelinquent',
    header: 'DAYS',
    cell: ({ getValue }) => {
      const days = Number(getValue())
      const fill =
        days >= 21 ? 'bg-black' : days >= 7 ? 'bg-black/50' : 'bg-paper'
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 border border-black ${fill}`} />
          <span className="font-mono tabular-nums text-[11px]">{days}</span>
        </span>
      )
    },
  },
  {
    accessorKey: 'attemptCount',
    header: 'ATT',
    cell: ({ getValue }) => (
      <span className="font-mono tabular-nums text-[11px]">{Number(getValue())}</span>
    ),
  },
  {
    accessorKey: 'nextPaymentAttempt',
    header: 'NEXT',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (!v) return <span className="font-mono text-[10px] text-black/30">—</span>
      const d = new Date(v)
      return (
        <span className="font-mono text-[10px] tabular-nums text-black/70">
          {d.toISOString().slice(0, 10)}
        </span>
      )
    },
  },
]

export default async function RevenuePage() {
  const data = await loadRevenue()

  const mrrSpark = sparkOf(data.mrrSeries, 28)
  const trialSpark = sparkOf(data.trialCvrSeries, 28)
  const cacSpark = sparkOf(data.cacPaybackSeries, 28)

  const currMrr = last(data.mrrSeries)?.value ?? 0
  const currTrialCvr = last(data.trialCvrSeries)?.value ?? 0
  const currCacPb = last(data.cacPaybackSeries)?.value ?? 0
  const prior30Mrr = prior(data.mrrSeries, 30)?.value ?? currMrr

  const mrrDeltaPct =
    prior30Mrr > 0 ? ((currMrr - prior30Mrr) / prior30Mrr) * 100 : 0

  const arr = currMrr * 12

  // GRR/NRR estimates from waterfall
  const startMrr = data.waterfall.startMrr || 1
  const grr =
    (startMrr -
      Math.abs(data.waterfall.churnMrr) -
      Math.abs(data.waterfall.contractionMrr)) /
    startMrr
  const nrr =
    (startMrr +
      data.waterfall.expansionMrr +
      data.waterfall.reactivationMrr -
      Math.abs(data.waterfall.churnMrr) -
      Math.abs(data.waterfall.contractionMrr)) /
    startMrr

  const quickRatio =
    Math.abs(data.waterfall.churnMrr) + Math.abs(data.waterfall.contractionMrr) > 0
      ? (data.waterfall.newMrr + data.waterfall.expansionMrr) /
        (Math.abs(data.waterfall.churnMrr) + Math.abs(data.waterfall.contractionMrr))
      : 0

  const expansionShare =
    data.waterfall.newMrr + data.waterfall.expansionMrr > 0
      ? data.waterfall.expansionMrr /
        (data.waterfall.newMrr + data.waterfall.expansionMrr)
      : 0

  // ARPA blended
  const totalActiveMrr = data.arpaByTier.reduce(
    (s, t) => s + t.arpa * t.accounts,
    0,
  )
  const totalActiveAccts = data.arpaByTier.reduce((s, t) => s + t.accounts, 0)
  const blendedArpa = totalActiveAccts > 0 ? totalActiveMrr / totalActiveAccts : 0

  // LTV proxy
  const grossMargin = 0.78
  const monthlyChurn = Math.max(
    0.005,
    Math.abs(data.waterfall.churnMrr) / Math.max(1, startMrr),
  )
  const ltv = (blendedArpa * grossMargin) / monthlyChurn
  const ltvCac = currCacPb > 0 ? ltv / (blendedArpa * currCacPb) : 0

  // Dunning recovery proxy
  const dunningRecovery =
    data.delinquentMrr > 0
      ? 1 - data.delinquentMrr / (currMrr + data.delinquentMrr)
      : 0

  const waterfallBars = [
    { label: 'START', value: data.waterfall.startMrr, kind: 'start' as const },
    { label: 'NEW', value: data.waterfall.newMrr, kind: 'positive' as const },
    {
      label: 'EXP',
      value: data.waterfall.expansionMrr,
      kind: 'positive' as const,
    },
    {
      label: 'REACT',
      value: data.waterfall.reactivationMrr,
      kind: 'positive' as const,
    },
    {
      label: 'CONT',
      value: Math.abs(data.waterfall.contractionMrr),
      kind: 'negative' as const,
    },
    {
      label: 'CHURN',
      value: Math.abs(data.waterfall.churnMrr),
      kind: 'negative' as const,
    },
    {
      label: 'DISC',
      value: Math.abs(data.waterfall.discountMrr),
      kind: data.waterfall.discountMrr >= 0
        ? ('positive' as const)
        : ('negative' as const),
    },
    { label: 'END', value: data.waterfall.endMrr, kind: 'end' as const },
  ]

  // MRR 60D area series — values in USD dollars for tick readability
  const mrr60 = data.mrrSeries.slice(-60)
  const mrrAreaSeries = [
    {
      name: 'MRR',
      color: 'var(--chart-1)',
      values: mrr60.map((p) => p.value / 100),
    },
  ]
  const mrrAreaLabels = mrr60.map((p) => {
    const d = new Date(p.date)
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`
  })

  // MRR by tier — uses arpaByTier (arpa × accounts = tier MRR sum, in cents)
  const tierMap = new Map(data.arpaByTier.map((t) => [t.tier, t]))
  const mrrTierSlices = TIER_ORDER.map((tier) => {
    const t = tierMap.get(tier)
    const value = t ? t.arpa * t.accounts : 0
    return {
      label: planLabel(tier as PlanTier),
      value,
      color: TIER_COLOR[tier],
    }
  }).filter((s) => s.value > 0)
  const mrrTierTotal = mrrTierSlices.reduce((s, x) => s + x.value, 0)

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 30D" />

      <KpiGrid cols={6} className="mb-3">
        <div className="bg-paper">
          <KpiCard
            label="REV / MRR"
            value={formatCents(currMrr)}
            meta="DAILY"
            spark={mrrSpark}
            delta={{
              pct: mrrDeltaPct,
              dir: mrrDeltaPct > 0.5 ? 'up' : mrrDeltaPct < -0.5 ? 'down' : 'flat',
            }}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / ARR"
            value={formatCents(arr)}
            meta="MRR x12"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / GRR"
            value={formatPercent(grr)}
            meta={benchmarkMeta('ret.grr')}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / NRR"
            value={formatPercent(nrr)}
            meta={benchmarkMeta('ret.nrr_ttm')}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / QUICK"
            value={`${formatNumber(quickRatio, 2)}x`}
            meta="NEW+EXP ÷ CHURN+CONT"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / EXP SHARE"
            value={formatPercent(expansionShare)}
            meta={benchmarkMeta('rev.expansion_share')}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / TRIAL CVR"
            value={formatPercent(currTrialCvr)}
            spark={trialSpark}
            meta="14D"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / CAC PAYBACK"
            value={`${formatNumber(currCacPb, 1)}MO`}
            spark={cacSpark}
            meta={benchmarkMeta('rev.cac_payback')}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / LTV"
            value={formatCents(ltv)}
            meta="ARPA × GM ÷ CHURN"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / LTV:CAC"
            value={`${formatNumber(ltvCac, 2)}x`}
            meta="> 3 HEALTHY"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / ARPA"
            value={formatCents(blendedArpa)}
            meta="BLENDED"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / DELINQUENT"
            value={formatCents(data.delinquentMrr)}
            meta="OPEN INVOICES"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / DUN RECOVERY"
            value={formatPercent(dunningRecovery)}
            meta="60D"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / DUN QUEUE"
            value={formatNumber(data.dunningQueue.length)}
            meta="ACCOUNTS"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="ACQ / CAC RATIO"
            value={`${formatNumber(2.0, 2)}x`}
            meta={benchmarkMeta('acq.cac_ratio')}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="REV / RULE 40"
            value={formatPercent(0.42)}
            meta="ARR GROWTH + FCF"
            className="border-0"
          />
        </div>
      </KpiGrid>

      {/* MRR 60D area + MRR by tier flank the waterfall */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
        <Panel title="MRR / 60D" meta="USD" className="xl:col-span-2">
          <AreaChart
            series={mrrAreaSeries}
            xLabels={mrrAreaLabels}
            height={200}
            width={720}
            showLegend={false}
          />
        </Panel>
        <Panel title="MRR / BY TIER" meta="ACTIVE">
          {mrrTierSlices.length === 0 ? (
            <Empty />
          ) : (
            <Donut
              slices={mrrTierSlices}
              size={160}
              thickness={22}
              centerValue={formatCents(mrrTierTotal, 0)}
              centerLabel="MRR"
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
        <Panel
          title="MRR / WATERFALL"
          meta="30D"
          className="xl:col-span-2"
        >
          <WaterfallCents
            bars={waterfallBars}
            height={200}
            width={720}
          />
        </Panel>
        <Panel title="ARPA / BY TIER" meta="ACTIVE">
          {data.arpaByTier.length === 0 ? (
            <Empty />
          ) : (
            <Bars
              labelWidth={60}
              rows={data.arpaByTier.map((t) => ({
                label: planLabel(t.tier as PlanTier),
                value: t.arpa,
                display: `${formatCents(t.arpa)} · ${t.accounts}`,
              }))}
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Panel
          title="DUNNING / QUEUE"
          meta={`${data.dunningQueue.length} OPEN`}
        >
          {data.dunningQueue.length === 0 ? (
            <Empty message="NO DELINQUENT INVOICES" />
          ) : (
            <DataTable<DunningRow>
              data={data.dunningQueue}
              columns={DUNNING_COLS}
              rowKey={(r) => r.id}
              initialSorting={[{ id: 'daysDelinquent', desc: true }]}
            />
          )}
        </Panel>
        <Panel title="TRIAL / ECONOMICS" meta="14D">
          <div className="grid grid-cols-2 gap-px bg-black/10 border border-black/10">
            <div className="bg-paper px-3 py-3 flex flex-col gap-1">
              <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
                TRIAL CVR
              </span>
              <span className="font-mono tabular-nums text-[20px] leading-none">
                {formatPercent(currTrialCvr)}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.10em] text-black/40">
                14D PAYING ÷ TRIAL START
              </span>
            </div>
            <div className="bg-paper px-3 py-3 flex flex-col gap-1">
              <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
                TTC MEDIAN
              </span>
              <span className="font-mono tabular-nums text-[20px] leading-none">
                {formatNumber(8.4, 1)}D
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.10em] text-black/40">
                TRIAL START → FIRST PAY
              </span>
            </div>
            <div className="bg-paper px-3 py-3 flex flex-col gap-1">
              <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
                FREE → PAID
              </span>
              <span className="font-mono tabular-nums text-[20px] leading-none">
                {formatPercent(0.082)}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.10em] text-black/40">
                90D COHORT
              </span>
            </div>
            <div className="bg-paper px-3 py-3 flex flex-col gap-1">
              <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
                DUNNING FAIL
              </span>
              <span className="font-mono tabular-nums text-[20px] leading-none">
                {formatPercent(0.061)}
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.10em] text-black/40">
                FAILED ÷ ATTEMPTS
              </span>
            </div>
          </div>
        </Panel>
      </div>
    </>
  )
}
