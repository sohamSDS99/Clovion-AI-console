import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { DataTable } from '@/components/admin/DataTable'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadGdpr, type GdprRow } from '@/lib/admin/queries/gdpr'
import { formatNumber, formatRelativeTime } from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'

const m = pageMeta['/gdpr']!

const NOW = 1717977600000

function StatusBox({ status }: { status: string }) {
  // solid = completed, half = in_progress, hollow = open, breached = inverted with X
  const s = status.toLowerCase()
  if (s === 'completed') {
    return (
      <span className="inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none bg-black text-white">
        COMPLETED
      </span>
    )
  }
  if (s === 'in_progress') {
    return (
      <span className="inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none bg-black/50 text-white">
        IN PROGRESS
      </span>
    )
  }
  if (s === 'breached') {
    return (
      <span className="inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none bg-black text-white">
        BREACHED
      </span>
    )
  }
  return (
    <span className="inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none border border-black text-black bg-paper">
      OPEN
    </span>
  )
}

function DeadlineCell({ days }: { days: number }) {
  // Indicator: solid (breach), half (T-2), hollow (T-7), ghost (>7)
  let mark: 'solid' | 'half' | 'hollow' | 'ghost'
  if (days <= 0) mark = 'solid'
  else if (days <= 2) mark = 'half'
  else if (days <= 7) mark = 'hollow'
  else mark = 'ghost'

  const indicator = (() => {
    const base = 'inline-block w-2 h-2 border border-black'
    if (mark === 'solid') return <span className={`${base} bg-black`} />
    if (mark === 'half')
      return (
        <span
          className={base}
          style={{
            background:
              'linear-gradient(to right, #000 0%, #000 50%, #fff 50%, #fff 100%)',
          }}
        />
      )
    if (mark === 'hollow') return <span className={`${base} bg-paper`} />
    return <span className={`${base} bg-paper border-black/30`} />
  })()

  const txt = days <= 0 ? `T+${Math.abs(days)}d OVER` : `T-${days}d`
  return (
    <span className="inline-flex items-center gap-1.5">
      {indicator}
      <span className="font-mono tabular-nums text-[10px]">{txt}</span>
    </span>
  )
}

function StepsBar({ steps }: { steps: GdprRow['steps'] }) {
  if (!steps || steps.length === 0) {
    return <span className="text-black/30 font-mono text-[10px]">—</span>
  }
  const done = steps.filter((s) => s.done).length
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex gap-0.5">
        {steps.map((s, i) => (
          <span
            key={i}
            className={`inline-block w-2 h-2 border border-black ${
              s.done ? 'bg-black' : 'bg-paper'
            }`}
            title={s.step}
          />
        ))}
      </span>
      <span className="font-mono tabular-nums text-[10px] text-black/70">
        {done}/{steps.length}
      </span>
    </div>
  )
}

function TypeBox({ type }: { type: 'delete' | 'export' }) {
  return (
    <span className="inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none border border-black text-black bg-paper">
      {type === 'delete' ? 'DEL' : 'EXP'}
    </span>
  )
}

function gdprColumns(now: number): ColumnDef<GdprRow, unknown>[] {
  return [
    {
      header: 'TYPE',
      accessorKey: 'type',
      cell: (c) => <TypeBox type={c.getValue<'delete' | 'export'>()} />,
    },
    {
      header: 'STATUS',
      accessorKey: 'status',
      cell: (c) => <StatusBox status={c.getValue<string>()} />,
    },
    {
      header: 'DEADLINE',
      accessorKey: 'daysToDeadline',
      cell: (c) => <DeadlineCell days={c.getValue<number>()} />,
    },
    {
      header: 'STEPS',
      accessorKey: 'steps',
      cell: (c) => <StepsBar steps={c.getValue<GdprRow['steps']>()} />,
    },
    {
      header: 'SUBJECT',
      accessorFn: (r) => r.userId ?? r.accountId ?? '—',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70 truncate">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'RECEIVED',
      accessorKey: 'receivedAt',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/60">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
    {
      header: 'DUE',
      accessorKey: 'deadlineAt',
      cell: (c) => {
        const v = c.getValue<number>()
        const d = new Date(v).toISOString().slice(0, 10)
        return (
          <span className="font-mono tabular-nums text-[10px] text-black/70">
            {d}
          </span>
        )
      },
    },
    {
      header: 'ID',
      accessorKey: 'id',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/45 truncate">
          {c.getValue<string>()}
        </span>
      ),
    },
  ]
}

export default async function GdprPage() {
  const data = await loadGdpr(NOW)

  const totalOpen = data.open.length
  const totalCompleted = data.completed.length
  const total = totalOpen + totalCompleted

  const deletions = data.open.filter((r) => r.type === 'delete').length
  const exports = data.open.filter((r) => r.type === 'export').length
  const tMinus2 = data.open.filter(
    (r) => r.daysToDeadline >= 0 && r.daysToDeadline <= 2,
  ).length
  const tMinus7 = data.open.filter(
    (r) => r.daysToDeadline >= 0 && r.daysToDeadline <= 7,
  ).length
  const breached = data.open.filter((r) => r.daysToDeadline <= 0).length
  const inProgress = data.open.filter((r) => r.status === 'in_progress').length

  // Median days to complete
  const completedDurations = data.completed
    .filter((r) => r.completedAt !== null)
    .map((r) => (r.completedAt! - r.receivedAt) / 86_400_000)
    .sort((a, b) => a - b)
  const medianDays =
    completedDurations.length > 0
      ? completedDurations[Math.floor(completedDurations.length / 2)] ?? 0
      : 0

  const breachCount = data.completed.filter((r) =>
    r.completedAt ? r.completedAt > r.deadlineAt : false,
  ).length

  const columns = gdprColumns(NOW)

  // Sort open queue by deadline proximity (closest first)
  const sortedOpen = [...data.open].sort(
    (a, b) => a.daysToDeadline - b.daysToDeadline,
  )

  return (
    <>
      <PageHeader
        section={m.section}
        label={m.label}
        meta="30-DAY DEADLINE · DSR QUEUE"
      />

      <KpiGrid cols={8}>
        <KpiCard label="gov.dsr" value={formatNumber(totalOpen)} meta="OPEN" />
        <KpiCard label="DELETE" value={formatNumber(deletions)} meta="OPEN" />
        <KpiCard label="EXPORT" value={formatNumber(exports)} meta="OPEN" />
        <KpiCard label="IN PROGRESS" value={formatNumber(inProgress)} meta="WIP" />
        <KpiCard label="T-7 DUE" value={formatNumber(tMinus7)} meta="WARN" />
        <KpiCard label="T-2 DUE" value={formatNumber(tMinus2)} meta="CRIT" />
        <KpiCard label="BREACHED" value={formatNumber(breached)} meta="OVERDUE" />
        <KpiCard label="COMPLETED" value={formatNumber(totalCompleted)} meta="ALL" />
        <KpiCard
          label="MEDIAN DAYS"
          value={medianDays.toFixed(1)}
          meta="TO COMPLETE"
        />
        <KpiCard
          label="HIST BREACHES"
          value={formatNumber(breachCount)}
          meta="LIFETIME"
        />
        <KpiCard label="TOTAL" value={formatNumber(total)} meta="ALL DSR" />
        <KpiCard
          label="SLA"
          value={breached === 0 ? 'OK' : 'BREACH'}
          meta="0-BREACH"
        />
      </KpiGrid>

      <div className="mt-3">
        <Panel
          title="OPEN QUEUE · DEADLINE SORTED"
          meta={`N=${totalOpen}`}
        >
          {totalOpen === 0 ? (
            <Empty message="NO OPEN REQUESTS" />
          ) : (
            <DataTable
              data={sortedOpen}
              columns={columns}
              rowKey={(r) => r.id}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>

      <div className="mt-3">
        <Panel
          title="COMPLETED"
          meta={`N=${totalCompleted}`}
        >
          {totalCompleted === 0 ? (
            <Empty message="NO COMPLETED REQUESTS" />
          ) : (
            <DataTable
              data={data.completed.slice(0, 50)}
              columns={columns}
              rowKey={(r) => r.id}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>
    </>
  )
}
