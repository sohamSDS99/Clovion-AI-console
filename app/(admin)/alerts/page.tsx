import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { DataTable } from '@/components/admin/DataTable'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadAlerts, type AlertRow } from '@/lib/admin/queries/alerts'
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  roleLabel,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'
import type { Role } from '@/lib/db/types'

const m = pageMeta['/alerts']!

function SevBox({ sev }: { sev: string }) {
  const fill =
    sev === 'critical' ? 'bg-black' : sev === 'warn' ? 'bg-black/50' : 'bg-paper'
  return <span className={`inline-block w-2 h-2 border border-black ${fill}`} />
}

function StatusBox({ status }: { status: string }) {
  const fill =
    status === 'resolved'
      ? 'bg-black'
      : status === 'acked'
        ? 'bg-black/50'
        : 'bg-paper'
  return <span className={`inline-block w-2 h-2 border border-black ${fill}`} />
}

const OPEN_COLS: ColumnDef<AlertRow, any>[] = [
  {
    accessorKey: 'severity',
    header: 'SEV',
    cell: ({ getValue }) => (
      <span className="inline-flex items-center gap-1.5">
        <SevBox sev={String(getValue())} />
        <span className="font-mono text-[10px] uppercase tracking-[0.10em]">
          {String(getValue())}
        </span>
      </span>
    ),
  },
  {
    accessorKey: 'metricKey',
    header: 'METRIC',
    cell: ({ getValue }) => (
      <span className="font-mono text-[11px]">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'zScore',
    header: 'Z-SCORE',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (v === null || v === undefined)
        return <span className="font-mono text-[10px] text-black/30">—</span>
      return (
        <span className="font-mono tabular-nums text-[11px]">
          {formatNumber(Number(v), 2)}σ
        </span>
      )
    },
  },
  {
    accessorKey: 'threshold',
    header: 'THRESH',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (v === null || v === undefined)
        return <span className="font-mono text-[10px] text-black/30">—</span>
      return (
        <span className="font-mono tabular-nums text-[11px] text-black/70">
          {formatNumber(Number(v), 2)}
        </span>
      )
    },
  },
  {
    accessorKey: 'ownerRole',
    header: 'OWNER',
    cell: ({ getValue }) => (
      <span className="font-mono text-[10px] uppercase tracking-[0.10em]">
        {roleLabel(String(getValue()) as Role)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'STATUS',
    cell: ({ getValue }) => (
      <span className="inline-flex items-center gap-1.5">
        <StatusBox status={String(getValue())} />
        <span className="font-mono text-[10px] uppercase tracking-[0.10em]">
          {String(getValue())}
        </span>
      </span>
    ),
  },
  {
    accessorKey: 'firedAt',
    header: 'FIRED',
    cell: ({ getValue }) => (
      <span className="font-mono text-[10px] tabular-nums text-black/70">
        {formatRelativeTime(Number(getValue()))} AGO
      </span>
    ),
  },
  {
    accessorKey: 'ackedAt',
    header: 'ACK SLA',
    cell: ({ row }) => {
      const r = row.original
      if (!r.ackedAt)
        return <span className="font-mono text-[10px] text-black/30">—</span>
      return (
        <span className="font-mono tabular-nums text-[10px]">
          {formatDuration(r.ackedAt - r.firedAt)}
        </span>
      )
    },
  },
]

const HISTORY_COLS: ColumnDef<AlertRow, any>[] = [
  {
    accessorKey: 'firedAt',
    header: 'FIRED',
    cell: ({ getValue }) => {
      const d = new Date(Number(getValue()))
      return (
        <span className="font-mono text-[10px] tabular-nums text-black/70">
          {d.toISOString().slice(0, 16).replace('T', ' ')}
        </span>
      )
    },
  },
  {
    accessorKey: 'severity',
    header: 'SEV',
    cell: ({ getValue }) => (
      <span className="inline-flex items-center gap-1.5">
        <SevBox sev={String(getValue())} />
        <span className="font-mono text-[10px] uppercase tracking-[0.10em]">
          {String(getValue())}
        </span>
      </span>
    ),
  },
  {
    accessorKey: 'metricKey',
    header: 'METRIC',
    cell: ({ getValue }) => (
      <span className="font-mono text-[11px]">{String(getValue())}</span>
    ),
  },
  {
    accessorKey: 'zScore',
    header: 'Z',
    cell: ({ getValue }) => {
      const v = getValue() as number | null
      if (v === null || v === undefined)
        return <span className="font-mono text-[10px] text-black/30">—</span>
      return (
        <span className="font-mono tabular-nums text-[11px]">
          {formatNumber(Number(v), 2)}σ
        </span>
      )
    },
  },
  {
    accessorKey: 'ownerRole',
    header: 'OWNER',
    cell: ({ getValue }) => (
      <span className="font-mono text-[10px] uppercase tracking-[0.10em]">
        {roleLabel(String(getValue()) as Role)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'STATUS',
    cell: ({ getValue }) => (
      <span className="inline-flex items-center gap-1.5">
        <StatusBox status={String(getValue())} />
        <span className="font-mono text-[10px] uppercase tracking-[0.10em]">
          {String(getValue())}
        </span>
      </span>
    ),
  },
  {
    accessorKey: 'resolvedAt',
    header: 'MTTR',
    cell: ({ row }) => {
      const r = row.original
      if (!r.resolvedAt)
        return <span className="font-mono text-[10px] text-black/30">—</span>
      return (
        <span className="font-mono tabular-nums text-[10px]">
          {formatDuration(r.resolvedAt - r.firedAt)}
        </span>
      )
    },
  },
]

export default async function AlertsPage() {
  const data = await loadAlerts()

  // KPIs
  const openCount = data.open.length
  const criticalOpen = data.open.filter((a) => a.severity === 'critical').length
  const warnOpen = data.open.filter((a) => a.severity === 'warn').length

  const ackedAlerts = data.history.filter((a) => a.ackedAt && a.firedAt)
  const meanAckMs =
    ackedAlerts.length > 0
      ? ackedAlerts.reduce((s, a) => s + ((a.ackedAt ?? 0) - a.firedAt), 0) /
        ackedAlerts.length
      : 0

  const resolved = data.history.filter((a) => a.resolvedAt && a.firedAt)
  const meanResolveMs =
    resolved.length > 0
      ? resolved.reduce((s, a) => s + ((a.resolvedAt ?? 0) - a.firedAt), 0) /
        resolved.length
      : 0

  // Aging buckets for open alerts
  const now = Date.now()
  const buckets = {
    lt15m: data.open.filter((a) => now - a.firedAt < 15 * 60_000).length,
    lt1h: data.open.filter(
      (a) => now - a.firedAt >= 15 * 60_000 && now - a.firedAt < 3_600_000,
    ).length,
    lt4h: data.open.filter(
      (a) => now - a.firedAt >= 3_600_000 && now - a.firedAt < 4 * 3_600_000,
    ).length,
    lt24h: data.open.filter(
      (a) =>
        now - a.firedAt >= 4 * 3_600_000 && now - a.firedAt < 24 * 3_600_000,
    ).length,
    gte24h: data.open.filter((a) => now - a.firedAt >= 24 * 3_600_000).length,
  }
  const agingBars = [
    { label: '< 15M', value: buckets.lt15m, display: String(buckets.lt15m) },
    { label: '< 1H', value: buckets.lt1h, display: String(buckets.lt1h) },
    { label: '< 4H', value: buckets.lt4h, display: String(buckets.lt4h) },
    { label: '< 24H', value: buckets.lt24h, display: String(buckets.lt24h) },
    { label: '≥ 24H', value: buckets.gte24h, display: String(buckets.gte24h) },
  ]

  // By owner
  const byOwnerMap = new Map<string, number>()
  for (const a of data.open) {
    byOwnerMap.set(a.ownerRole, (byOwnerMap.get(a.ownerRole) ?? 0) + 1)
  }
  const ownerBars = Array.from(byOwnerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([role, count]) => ({
      label: role.toUpperCase(),
      value: count,
      display: String(count),
    }))

  // By metric
  const byMetricMap = new Map<string, number>()
  for (const a of data.history) {
    byMetricMap.set(a.metricKey, (byMetricMap.get(a.metricKey) ?? 0) + 1)
  }
  const metricBars = Array.from(byMetricMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({
      label: key,
      value: count,
      display: String(count),
    }))

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 90D" />

      <KpiGrid cols={6} className="mb-3">
        <div className="bg-paper">
          <KpiCard
            label="ALR / OPEN"
            value={formatNumber(openCount)}
            meta={`${criticalOpen} CRIT · ${warnOpen} WARN`}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="ALR / CRITICAL"
            value={formatNumber(criticalOpen)}
            meta="OPEN"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="ALR / MEAN ACK"
            value={formatDuration(meanAckMs)}
            meta="HIST 90D"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="ALR / MTTR"
            value={formatDuration(meanResolveMs)}
            meta="RESOLVED"
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="ALR / PRECISION"
            value={formatPercent(data.precisionLast30d.precision)}
            meta={`${data.precisionLast30d.truePositives} TP / ${data.precisionLast30d.falsePositives} FP`}
            className="border-0"
          />
        </div>
        <div className="bg-paper">
          <KpiCard
            label="ALR / VOLUME"
            value={formatNumber(data.history.length)}
            meta="FIRED 90D"
            className="border-0"
          />
        </div>
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 mb-3">
        <Panel title="OPEN / BY AGE" meta={`${openCount} OPEN`}>
          {agingBars.every((b) => b.value === 0) ? (
            <Empty message="NO OPEN ALERTS" />
          ) : (
            <Bars rows={agingBars} labelWidth={60} />
          )}
        </Panel>
        <Panel title="OPEN / BY OWNER" meta={`${ownerBars.length} ROLES`}>
          {ownerBars.length === 0 ? (
            <Empty />
          ) : (
            <Bars rows={ownerBars} labelWidth={70} />
          )}
        </Panel>
        <Panel title="TOP / METRICS" meta="90D FIRED">
          {metricBars.length === 0 ? (
            <Empty />
          ) : (
            <Bars rows={metricBars} labelWidth={140} />
          )}
        </Panel>
      </div>

      <Panel title="OPEN / ALERTS" meta={`${openCount} OPEN`} className="mb-3">
        {data.open.length === 0 ? (
          <Empty message="NO OPEN ALERTS" />
        ) : (
          <DataTable<AlertRow>
            data={data.open}
            columns={OPEN_COLS}
            rowKey={(r) => r.id}
            initialSorting={[{ id: 'firedAt', desc: true }]}
          />
        )}
      </Panel>

      <Panel title="HISTORY / 90D" meta={`${data.history.length} ROWS`}>
        {data.history.length === 0 ? (
          <Empty />
        ) : (
          <DataTable<AlertRow>
            data={data.history}
            columns={HISTORY_COLS}
            rowKey={(r) => r.id}
            initialSorting={[{ id: 'firedAt', desc: true }]}
          />
        )}
      </Panel>
    </>
  )
}
