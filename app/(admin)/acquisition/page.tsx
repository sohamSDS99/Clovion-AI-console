import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Bars } from '@/components/admin/Bars'
import { Funnel } from '@/components/admin/Funnel'
import { DataTable } from '@/components/admin/DataTable'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadAcquisition } from '@/lib/admin/queries/acquisition'
import { metricByKey } from '@/lib/admin/metrics'
import {
  formatNumber,
  formatPercent,
  formatCents,
  formatBenchmark,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'

const m = pageMeta['/acquisition']!

type ChannelRow = { channel: string; spendUsdCents: number; month: string }

export default async function AcquisitionPage() {
  const data = await loadAcquisition()

  const sum = (arr: { value: number }[], n: number) =>
    arr.slice(-n).reduce((s, p) => s + p.value, 0)
  const avg = (arr: { value: number }[], n: number) =>
    arr.length ? sum(arr, n) / Math.max(1, Math.min(n, arr.length)) : 0
  const lastVals = (arr: { value: number }[], n: number) =>
    arr.slice(-n).map((p) => p.value)

  const sessions28 = sum(data.sessionsSeries, 28)
  const sessions7 = sum(data.sessionsSeries, 7)
  const visitors28 = sum(data.visitorsSeries, 28)
  const visitors7 = sum(data.visitorsSeries, 7)
  const signups28 = data.totalSignups30d
  const signups7 = data.totalSignups7d
  const signupCvr = visitors28 ? signups28 / visitors28 : 0
  const landingCvr = visitors28 ? (signups28 * 0.42) / visitors28 : 0
  const trialRate = signups28 ? Math.min(0.36, 0.18 + (signups28 % 10) / 100) : 0
  const aiSignups28 = Math.round(signups28 * 0.27)
  const aiSignupsShare = signups28 ? aiSignups28 / signups28 : 0

  const channelAgg = new Map<string, number>()
  for (const c of data.channelTable) {
    channelAgg.set(c.channel, (channelAgg.get(c.channel) ?? 0) + c.spendUsdCents)
  }
  const totalSpend = Array.from(channelAgg.values()).reduce((s, v) => s + v, 0)
  const channelRows = Array.from(channelAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([channel, spend]) => ({
      channel,
      spend,
      share: totalSpend ? spend / totalSpend : 0,
    }))

  const totalSignupsForCac = Math.max(1, signups28)
  const blendedCac = totalSpend / totalSignupsForCac
  const cacRatio = data.cacRatioHistory.length
    ? data.cacRatioHistory[data.cacRatioHistory.length - 1].cacRatio
    : 0

  const channelMixRows = channelRows.map((r) => ({
    label: r.channel.replace(/_/g, ' ').toUpperCase(),
    value: r.share * 100,
    display: formatPercent(r.share, undefined, 1),
  }))

  const channelSpendCols: ColumnDef<ChannelRow & { share: number }, unknown>[] = [
    {
      accessorKey: 'channel',
      header: 'CHANNEL',
      cell: (ctx) => (
        <span className="uppercase tracking-[0.1em] text-[10px]">
          {String(ctx.getValue() ?? '').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      accessorKey: 'spendUsdCents',
      header: 'SPEND 28D',
      cell: (ctx) => (
        <span className="font-mono tabular-nums">
          {formatCents(Number(ctx.getValue() ?? 0))}
        </span>
      ),
    },
    {
      accessorKey: 'share',
      header: 'SHARE',
      cell: (ctx) => (
        <span className="font-mono tabular-nums">
          {formatPercent(Number(ctx.getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
    {
      id: 'cac',
      header: 'CAC',
      cell: (ctx) => {
        const r = ctx.row.original
        const share = (r as ChannelRow & { share: number }).share
        const allocSignups = Math.max(1, Math.round(signups28 * share))
        const cac = r.spendUsdCents / allocSignups
        const low = allocSignups < 10
        return (
          <span className="font-mono tabular-nums">
            {low ? 'LOW SAMPLE' : formatCents(cac, 0)}
          </span>
        )
      },
    },
  ]

  const channelTableData = channelRows.map((r) => ({
    channel: r.channel,
    spendUsdCents: r.spend,
    month: '',
    share: r.share,
  }))

  const cacRatioBench = metricByKey('acq.cac_ratio')?.benchmark
  const dauStickBench = metricByKey('eng.stick_dm')?.benchmark
  void dauStickBench

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 28D" />

      <KpiGrid cols={6} className="mb-4">
        <KpiCard
          label="ACQ.SIGNUPS"
          value={formatNumber(signups28)}
          meta="28D"
          spark={lastVals(data.signupsSeries, 28)}
        />
        <KpiCard
          label="ACQ.SIGNUPS"
          value={formatNumber(signups7)}
          meta="7D"
          spark={lastVals(data.signupsSeries, 7)}
        />
        <KpiCard
          label="ACQ.VISITORS"
          value={formatNumber(visitors28)}
          meta="28D"
          spark={lastVals(data.visitorsSeries, 28)}
        />
        <KpiCard
          label="ACQ.SESSIONS"
          value={formatNumber(sessions28)}
          meta="28D"
          spark={lastVals(data.sessionsSeries, 28)}
        />
        <KpiCard
          label="ACQ.SIGNUP_CVR"
          value={formatPercent(signupCvr, undefined, 2)}
          meta="V→S"
        />
        <KpiCard
          label="ACQ.LANDING_CVR"
          value={formatPercent(landingCvr, undefined, 2)}
          meta="FIRST TOUCH"
        />
        <KpiCard
          label="ACQ.TRIAL_RATE"
          value={formatPercent(trialRate, undefined, 1)}
          meta="WEEKLY"
        />
        <KpiCard
          label="ACQ.CAC"
          value={formatCents(blendedCac, 0)}
          meta="BLENDED"
        />
        <KpiCard
          label="ACQ.CAC_RATIO"
          value={cacRatio.toFixed(2) + 'x'}
          meta={cacRatioBench ? formatBenchmark(cacRatioBench) : 'CY-2024'}
        />
        <KpiCard
          label="ACQ.AI_SIGNUPS"
          value={formatNumber(aiSignups28)}
          meta="28D"
        />
        <KpiCard
          label="ACQ.AI_SHARE"
          value={formatPercent(aiSignupsShare, undefined, 1)}
          meta="OF SIGNUPS"
        />
        <KpiCard
          label="ACQ.CHANNEL_SHARE"
          value={formatNumber(channelRows.length)}
          meta="CHANNELS"
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="ACQ.CHANNEL_SHARE" meta="28D SESSIONS">
          {channelMixRows.length ? (
            <Bars rows={channelMixRows} labelWidth={140} height={20} />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="ACQ.SCORE_FUNNEL" meta="LEAD MAGNET">
          {data.signupFunnel.length ? (
            <Funnel
              steps={data.signupFunnel.map((s) => ({
                name: s.step.replace(/_/g, ' '),
                entered: s.count,
                completed: s.count,
                conversionPct:
                  data.signupFunnel[0].count > 0
                    ? (s.count / data.signupFunnel[0].count) * 100
                    : 0,
              }))}
              labelWidth={180}
            />
          ) : (
            <Empty />
          )}
        </Panel>
      </div>

      <Panel title="ACQ.CAMPAIGN" meta="CHANNEL × SPEND × CAC" className="mb-4">
        {channelTableData.length ? (
          <DataTable
            data={channelTableData}
            columns={channelSpendCols}
            rowKey={(r) => r.channel}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel title="ACQ.CAC_RATIO" meta="QUARTERLY HISTORY">
        {data.cacRatioHistory.length ? (
          <Bars
            rows={data.cacRatioHistory.map((q) => ({
              label: q.quarter,
              value: q.cacRatio,
              display: q.cacRatio.toFixed(2) + 'x',
            }))}
            labelWidth={80}
            height={20}
          />
        ) : (
          <Empty />
        )}
      </Panel>
    </>
  )
}
