import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { DataTable } from '@/components/admin/DataTable'
import { Waterfall } from '@/components/admin/Waterfall'
import { FreshnessStrip } from '@/components/admin/FreshnessStrip'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadCommandCenter } from '@/lib/admin/queries/command-center'
import { loadRevenue } from '@/lib/admin/queries/revenue'
import { metricByKey } from '@/lib/admin/metrics'
import {
  formatBenchmark,
  formatCents,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTokens,
  roleLabel,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'

const m = pageMeta['/']!

type AlertRow = {
  id: string
  metricKey: string
  severity: string
  firedAt: number
  ownerRole: string
}

function tileLabel(key: string): string {
  return key.toUpperCase().replace(/\./g, ' / ')
}

function renderTileValue(key: string, value: number, num?: number, den?: number): string {
  const def = metricByKey(key)
  const unit = def?.unit ?? 'count'
  switch (unit) {
    case 'cents':
      return formatCents(value)
    case 'microcents':
      return formatCents(value / 10_000)
    case 'pct':
      return formatPercent(value)
    case 'ratio':
      return `${formatNumber(value, 2)}x`
    case 'ms':
      return formatDuration(value)
    case 'duration_h':
      return `${formatNumber(value, 1)}h`
    case 'score':
      return formatNumber(value, 1)
    case 'count':
    default:
      return formatTokens(value)
  }
}

function tileMeta(key: string): string | undefined {
  const def = metricByKey(key)
  if (def?.benchmark) return formatBenchmark(def.benchmark)
  return def?.grain.toUpperCase()
}

const ALERT_COLS: ColumnDef<AlertRow, any>[] = [
  {
    accessorKey: 'metricKey',
    header: 'METRIC',
    cell: ({ getValue }) => (
      <span className="font-mono text-[11px]">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'severity',
    header: 'SEV',
    cell: ({ getValue }) => {
      const v = String(getValue())
      const fill =
        v === 'critical' ? 'bg-black' : v === 'warn' ? 'bg-black/50' : 'bg-paper'
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-2 h-2 border border-black ${fill}`} />
          <span className="font-mono text-[10px] uppercase tracking-[0.10em]">{v}</span>
        </span>
      )
    },
  },
  {
    accessorKey: 'ownerRole',
    header: 'OWNER',
    cell: ({ getValue }) => (
      <span className="font-mono text-[10px] uppercase tracking-[0.10em]">
        {roleLabel(String(getValue()) as 'owner')}
      </span>
    ),
  },
  {
    accessorKey: 'firedAt',
    header: 'FIRED',
    cell: ({ getValue }) => (
      <span className="font-mono text-[10px] text-black/70">
        {formatRelativeTime(Number(getValue()))}
      </span>
    ),
  },
]

export default async function CommandCenterPage() {
  const data = await loadCommandCenter()
  const rev = await loadRevenue()

  const freshnessRows = data.freshness.map((f) => ({
    source: f.source.toUpperCase(),
    lagSeconds: f.lagSeconds,
    state: (f.state === 'solid'
      ? 'green'
      : f.state === 'half'
        ? 'amber'
        : 'red') as 'green' | 'amber' | 'red',
  }))

  const waterfall = [
    { label: 'START', value: rev.waterfall.startMrr, kind: 'start' as const },
    { label: 'NEW', value: rev.waterfall.newMrr, kind: 'positive' as const },
    { label: 'EXP', value: rev.waterfall.expansionMrr, kind: 'positive' as const },
    {
      label: 'REACT',
      value: rev.waterfall.reactivationMrr,
      kind: 'positive' as const,
    },
    {
      label: 'CONT',
      value: Math.abs(rev.waterfall.contractionMrr),
      kind: 'negative' as const,
    },
    {
      label: 'CHURN',
      value: Math.abs(rev.waterfall.churnMrr),
      kind: 'negative' as const,
    },
    { label: 'END', value: rev.waterfall.endMrr, kind: 'end' as const },
  ]

  return (
    <>
      <PageHeader
        section={m.section}
        label={m.label}
        meta="LAST 28D"
        right={<FreshnessStrip rows={freshnessRows} />}
      />

      {/* Anchor KPIs — large, prominent */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-black/15 border border-black/15 mb-3">
        {data.anchors.map((t) => (
          <div key={t.key} className="bg-paper lg:col-span-1">
            <KpiCard
              label={tileLabel(t.key)}
              value={renderTileValue(t.key, t.value, t.numerator, t.denominator)}
              meta={tileMeta(t.key)}
              className="border-0"
            />
          </div>
        ))}
        {/* Pad anchor row with totals */}
        <div className="bg-paper">
          <KpiCard
            label="LLM / DAILY BUDGET"
            value={formatCents(data.llmBudgetCents)}
            meta="OPS"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="ALERTS / OPEN"
            value={formatNumber(data.openAlerts.length)}
            meta={`${data.openAlerts.filter((a) => a.severity === 'critical').length} CRIT`}
            className="border-0"
          />
        </div>
      </div>

      {/* Tile grid */}
      <KpiGrid cols={6} className="mb-3">
        {data.tiles.map((t) => (
          <div key={t.key} className="bg-paper">
            <KpiCard
              label={tileLabel(t.key)}
              value={renderTileValue(t.key, t.value, t.numerator, t.denominator)}
              meta={tileMeta(t.key)}
              className="border-0"
            />
          </div>
        ))}
      </KpiGrid>

      {/* Two-column: Anomalies + MRR waterfall */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-3">
        <Panel title="ANOMALIES / 7D" meta={`${data.openAlerts.length} OPEN`}>
          {data.openAlerts.length === 0 ? (
            <Empty message="NO OPEN ALERTS" />
          ) : (
            <DataTable<AlertRow>
              data={data.openAlerts}
              columns={ALERT_COLS}
              rowKey={(r) => r.id}
            />
          )}
        </Panel>
        <Panel title="MRR / 30D WATERFALL" meta="USD">
          <Waterfall
            bars={waterfall}
            format={(v) => formatCents(v, 0)}
            height={180}
            width={680}
          />
        </Panel>
      </div>

      {/* Freshness panel */}
      <Panel title="FRESHNESS / SOURCES" meta="LAG VS SLA">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-black/10 border border-black/10">
          {data.freshness.map((f) => {
            const fill =
              f.state === 'solid'
                ? 'bg-black'
                : f.state === 'half'
                  ? 'bg-black/50'
                  : 'bg-paper'
            return (
              <div
                key={f.source}
                className="bg-paper px-3 py-2 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
                    {f.source}
                  </span>
                  <span
                    className={`inline-block w-2 h-2 border border-black ${fill}`}
                  />
                </div>
                <div className="font-mono tabular-nums text-[13px]">
                  {formatDuration(f.lagSeconds * 1000)}
                </div>
                <div className="text-[9px] font-mono uppercase tracking-[0.10em] text-black/40">
                  SLA {formatDuration(f.thresholdSeconds * 1000)}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </>
  )
}
