import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { DataTable } from '@/components/admin/DataTable'
import { Empty } from '@/components/admin/Empty'
import { Donut } from '@/components/admin/charts/Donut'
import { AreaChart } from '@/components/admin/charts/AreaChart'
import { MultiLine } from '@/components/admin/charts/MultiLine'
import { pageMeta } from '@/lib/admin/content'
import { loadChannels } from '@/lib/admin/queries/channels'
import { formatCents, formatNumber, formatPercent } from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'
import type { ChannelRow } from '@/lib/admin/queries/channels'

const m = pageMeta['/channels']!

function channelLabel(c: string): string {
  return c.replace(/_/g, ' ').toUpperCase()
}

const NUM_CELL = 'font-mono tabular-nums text-right block'

export default async function ChannelsPage() {
  const data = await loadChannels()
  const { aggregate, rows, donutRevenue, donutSignups, timeSeriesRevenue, timeSeriesSignups, retentionCurves } = data

  const totalRevenue = donutRevenue.reduce((s, x) => s + x.value, 0)
  const totalSignups = donutSignups.reduce((s, x) => s + x.value, 0)

  const columns: ColumnDef<ChannelRow>[] = [
    {
      id: 'channel',
      accessorKey: 'channel',
      header: 'CHANNEL',
      cell: ({ getValue }) => (
        <span className="font-mono uppercase tracking-[0.10em] text-[10px] text-left block">
          {channelLabel(String(getValue() ?? ''))}
        </span>
      ),
    },
    {
      id: 'sessions28d',
      accessorKey: 'sessions28d',
      header: <span className="block text-right">SESSIONS 28D</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatNumber(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'visitors28d',
      accessorKey: 'visitors28d',
      header: <span className="block text-right">VISITORS 28D</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatNumber(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'signups28d',
      accessorKey: 'signups28d',
      header: <span className="block text-right">SIGNUPS 28D</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatNumber(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'signupCvr',
      accessorKey: 'signupCvr',
      header: <span className="block text-right">SIGNUP CVR</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 2)}
        </span>
      ),
    },
    {
      id: 'aiSignups',
      accessorKey: 'aiSignups',
      header: <span className="block text-right">AI SIGNUPS</span>,
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        return (
          <span className={NUM_CELL}>
            {v == null ? <span className="text-black/30">—</span> : formatNumber(v)}
          </span>
        )
      },
    },
    {
      id: 'trialCvr',
      accessorKey: 'trialCvr',
      header: <span className="block text-right">TRIAL CVR</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
    {
      id: 'payingAccts',
      accessorKey: 'payingAccts',
      header: <span className="block text-right">PAYING</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatNumber(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'mrrUsdCents',
      accessorKey: 'mrrUsdCents',
      header: <span className="block text-right">MRR</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatCents(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'revShare',
      accessorKey: 'revShare',
      header: <span className="block text-right">REV SHARE</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
    {
      id: 'arpaUsdCents',
      accessorKey: 'arpaUsdCents',
      header: <span className="block text-right">ARPA</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatCents(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'cacUsdCents',
      accessorKey: 'cacUsdCents',
      header: <span className="block text-right">CAC</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatCents(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'ltvUsdCents',
      accessorKey: 'ltvUsdCents',
      header: <span className="block text-right">LTV</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatCents(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'ltvCac',
      accessorKey: 'ltvCac',
      header: <span className="block text-right">LTV:CAC</span>,
      cell: ({ getValue }) => {
        const v = Number(getValue() ?? 0)
        return (
          <span className={NUM_CELL}>
            {Number.isFinite(v) && v > 0 ? `${v.toFixed(2)}x` : '—'}
          </span>
        )
      },
    },
    {
      id: 'churn30d',
      accessorKey: 'churn30d',
      header: <span className="block text-right">CHURN 30D</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
    {
      id: 'dauShare',
      accessorKey: 'dauShare',
      header: <span className="block text-right">DAU SHARE</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
    {
      id: 'mauShare',
      accessorKey: 'mauShare',
      header: <span className="block text-right">MAU SHARE</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta={m.meta?.toUpperCase()} />

      <KpiGrid cols={8} className="mb-4">
        <KpiCard label="SESSIONS" value={formatNumber(aggregate.sessions28d)} />
        <KpiCard label="SIGNUPS" value={formatNumber(aggregate.signups28d)} />
        <KpiCard
          label="SIGNUP CVR"
          value={formatPercent(aggregate.signupCvr, undefined, 2)}
        />
        <KpiCard label="PAYING ACCTS" value={formatNumber(aggregate.payingAccts)} />
        <KpiCard label="MRR" value={formatCents(aggregate.mrrUsdCents)} />
        <KpiCard label="CAC" value={formatCents(aggregate.blendedCac)} meta="blended" />
        <KpiCard label="LTV" value={formatCents(aggregate.blendedLtv)} meta="blended" />
        <KpiCard
          label="LTV:CAC"
          value={
            aggregate.blendedLtvCac > 0
              ? `${aggregate.blendedLtvCac.toFixed(2)}x`
              : '—'
          }
          meta=">3 ok"
        />
      </KpiGrid>

      <Panel
        title="CHANNEL MATRIX"
        meta={`${rows.length} channels`}
        padding="none"
        className="mb-4"
      >
        {rows.length ? (
          <DataTable<ChannelRow>
            data={rows}
            columns={columns}
            rowKey={(r) => r.channel}
            initialSorting={[{ id: 'mrrUsdCents', desc: true }]}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Panel title="REVENUE / BY CHANNEL" meta={formatCents(totalRevenue)}>
          {donutRevenue.length ? (
            <Donut
              slices={donutRevenue}
              size={170}
              thickness={22}
              centerValue={formatCents(totalRevenue)}
              centerLabel="MRR"
            />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel
          title="SIGNUPS / BY CHANNEL"
          meta={`${formatNumber(totalSignups)} signups`}
        >
          {donutSignups.length ? (
            <Donut
              slices={donutSignups}
              size={170}
              thickness={22}
              centerValue={formatNumber(totalSignups)}
              centerLabel="SIGNUPS"
            />
          ) : (
            <Empty />
          )}
        </Panel>
      </div>

      <Panel
        title="SIGNUPS PER DAY · 28D"
        meta="stacked by channel"
        className="mb-4"
      >
        {timeSeriesSignups.length ? (
          <AreaChart series={timeSeriesSignups} height={220} smooth showLegend />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        title="REVENUE / BY CHANNEL · 60D"
        meta="$ per day"
        className="mb-4"
      >
        {timeSeriesRevenue.length ? (
          <MultiLine series={timeSeriesRevenue} height={220} smooth showLegend />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        title="RETENTION CURVES / BY CHANNEL"
        meta="day 0–30 logo retention"
        padding="none"
      >
        <div className="grid grid-cols-3 gap-4 p-3">
          {retentionCurves.map((c) => (
            <div key={c.channel} className="border border-black/10 p-2">
              <div className="text-[9.5px] uppercase tracking-[0.12em] opacity-55 mb-1 font-mono">
                {channelLabel(c.channel)}
              </div>
              <AreaChart
                series={[{ name: c.channel, color: c.color, values: c.values }]}
                height={70}
                smooth
                showLegend={false}
              />
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}
