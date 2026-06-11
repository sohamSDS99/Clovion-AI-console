import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { DataTable } from '@/components/admin/DataTable'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadFlags, type FlagRow } from '@/lib/admin/queries/flags'
import { formatNumber, formatRelativeTime } from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'

const m = pageMeta['/flags']!

function StateBox({ enabled }: { enabled: boolean }) {
  const cls = enabled
    ? 'bg-black text-white'
    : 'border border-black text-black bg-paper'
  return (
    <span
      className={`inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none ${cls}`}
    >
      {enabled ? 'ON' : 'OFF'}
    </span>
  )
}

function RolloutBar({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, pct))
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative bg-black/5"
        style={{ width: 60, height: 6 }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-black"
          style={{ width: `${v.toFixed(2)}%` }}
        />
      </div>
      <span className="font-mono tabular-nums text-[10px] text-black/80">
        {v.toFixed(0)}%
      </span>
    </div>
  )
}

function flagColumns(now: number): ColumnDef<FlagRow, unknown>[] {
  return [
    {
      header: 'STATE',
      accessorKey: 'enabled',
      cell: (c) => <StateBox enabled={c.getValue<boolean>()} />,
    },
    {
      header: 'FLAG',
      accessorKey: 'flagKey',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'DESCRIPTION',
      accessorKey: 'description',
      cell: (c) => (
        <span className="text-[10.5px] text-black/70 truncate">
          {c.getValue<string>() || '—'}
        </span>
      ),
    },
    {
      header: 'ROLLOUT',
      accessorKey: 'rollout',
      cell: (c) => <RolloutBar pct={c.getValue<number>()} />,
    },
    {
      header: 'LAST BY',
      accessorKey: 'lastChangedBy',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70 truncate">
          {c.getValue<string>() || '—'}
        </span>
      ),
    },
    {
      header: 'LAST CHANGE',
      accessorKey: 'lastChangedAt',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/60">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
    {
      header: 'REASON',
      accessorKey: 'lastChangeReason',
      cell: (c) => (
        <span className="text-[10px] text-black/55 truncate max-w-[220px] inline-block">
          {c.getValue<string>() || '—'}
        </span>
      ),
    },
  ]
}

export default async function FlagsPage() {
  const data = await loadFlags()
  const now = Date.now()

  const total = data.flags.length
  const enabled = data.flags.filter((f) => f.enabled).length
  const disabled = total - enabled
  const fullRollout = data.flags.filter((f) => f.enabled && f.rollout >= 100).length
  const partial = data.flags.filter((f) => f.enabled && f.rollout > 0 && f.rollout < 100).length
  const changes24h = data.flags.filter(
    (f) => now - f.lastChangedAt < 86_400_000,
  ).length
  const changes7d = data.flags.filter(
    (f) => now - f.lastChangedAt < 7 * 86_400_000,
  ).length
  const stale30d = data.flags.filter(
    (f) => now - f.lastChangedAt > 30 * 86_400_000,
  ).length

  const lastSync = data.flags.reduce(
    (m, f) => Math.max(m, f.lastChangedAt),
    0,
  )

  const columns = flagColumns(now)

  const historyColumns: ColumnDef<typeof data.history[number], unknown>[] = [
    {
      header: 'ID',
      accessorKey: 'id',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/55">
          #{c.getValue<number>()}
        </span>
      ),
    },
    {
      header: 'ACTOR',
      accessorKey: 'actorStaffId',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70 truncate">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'FLAG',
      accessorKey: 'objectId',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'AT',
      accessorKey: 'at',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/60">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="POSTHOG 5M SYNC" />

      <KpiGrid cols={8}>
        <KpiCard label="FLAGS" value={formatNumber(total)} meta="MIRROR" />
        <KpiCard label="ENABLED" value={formatNumber(enabled)} meta="ON" />
        <KpiCard label="DISABLED" value={formatNumber(disabled)} meta="OFF" />
        <KpiCard label="FULL ROLLOUT" value={formatNumber(fullRollout)} meta="100%" />
        <KpiCard label="PARTIAL" value={formatNumber(partial)} meta="0-100%" />
        <KpiCard label="CHANGES 24H" value={formatNumber(changes24h)} meta="EDIT" />
        <KpiCard label="CHANGES 7D" value={formatNumber(changes7d)} meta="EDIT" />
        <KpiCard label="STALE > 30D" value={formatNumber(stale30d)} meta="AGE" />
      </KpiGrid>

      <div className="mt-3">
        <Panel
          title="FEATURE FLAG MIRROR"
          meta={`N=${total} · LAST CHANGE ${formatRelativeTime(lastSync, now)}`}
        >
          {total === 0 ? (
            <Empty message="NO FLAGS" />
          ) : (
            <DataTable
              data={data.flags}
              columns={columns}
              rowKey={(r) => r.flagKey}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>

      <div className="mt-3">
        <Panel
          title="TOGGLE HISTORY"
          meta={`N=${data.history.length} · AUDIT LOG`}
        >
          {data.history.length === 0 ? (
            <Empty message="NO TOGGLES RECORDED" />
          ) : (
            <DataTable
              data={data.history}
              columns={historyColumns}
              rowKey={(r) => String(r.id)}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>
    </>
  )
}
