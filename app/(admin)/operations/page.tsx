import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { DataTable } from '@/components/admin/DataTable'
import { Bars } from '@/components/admin/Bars'
import { Badge } from '@/components/admin/Badge'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadOperations, type AdminActionRow } from '@/lib/admin/queries/operations'
import {
  formatNumber,
  formatRelativeTime,
  formatCents,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'
import type {
  AdminActionType,
  AdminActionStatus,
} from '@/lib/db/types'

const m = pageMeta['/operations']!

const TYPE_LABEL: Record<AdminActionType, string> = {
  impersonation: 'IMP',
  plan_override: 'PLN',
  refund: 'RFD',
  credit: 'CRD',
  kill_switch: 'KSW',
  flag_change: 'FLG',
  gdpr: 'GDP',
}

const STATUS_GLYPH: Record<AdminActionStatus, string> = {
  requested: '◻',
  approved: '◧',
  executed: '◼',
  failed: '✕',
  expired: '○',
}

function StatusBox({ status }: { status: AdminActionStatus }) {
  const cls =
    status === 'executed'
      ? 'bg-black text-white'
      : status === 'approved'
      ? 'bg-black/50 text-white'
      : status === 'failed'
      ? 'border border-black text-black bg-paper'
      : status === 'expired'
      ? 'border border-black/40 text-black/40 bg-paper'
      : 'border border-black text-black bg-paper'
  return (
    <span
      className={`inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] tabular-nums px-1.5 py-0.5 leading-none ${cls}`}
    >
      {status.toUpperCase()}
    </span>
  )
}

function refundAmountCents(row: AdminActionRow): number {
  const p = row.params as Record<string, unknown>
  const v = p['amount_usd_cents']
  return typeof v === 'number' ? v : 0
}

function actionColumns(now: number): ColumnDef<AdminActionRow, unknown>[] {
  return [
    {
      header: 'TYPE',
      accessorKey: 'type',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
          {TYPE_LABEL[c.getValue<AdminActionType>()]}
        </span>
      ),
    },
    {
      header: 'STATUS',
      accessorKey: 'status',
      cell: (c) => <StatusBox status={c.getValue<AdminActionStatus>()} />,
    },
    {
      header: 'TARGET',
      accessorKey: 'targetAccountName',
      cell: (c) => {
        const row = c.row.original
        return (
          <span className="font-mono text-[10.5px] truncate">
            {row.targetAccountName ?? row.targetAccountId ?? '—'}
          </span>
        )
      },
    },
    {
      header: 'REQ',
      accessorKey: 'requestedBy',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70 truncate">
          {String(c.getValue() ?? '—')}
        </span>
      ),
    },
    {
      header: 'APR',
      accessorKey: 'approvedBy',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70 truncate">
          {String(c.getValue() ?? '—')}
        </span>
      ),
    },
    {
      header: 'AMT',
      accessorFn: (r) => refundAmountCents(r),
      cell: (c) => {
        const v = c.getValue<number>()
        return v > 0 ? (
          <span className="font-mono tabular-nums text-[10.5px]">{formatCents(v)}</span>
        ) : (
          <span className="text-black/30">—</span>
        )
      },
    },
    {
      header: 'AGE',
      accessorKey: 'createdAt',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/60">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
    {
      header: 'EXP',
      accessorKey: 'expiresAt',
      cell: (c) => {
        const v = c.getValue<number | null>()
        return v ? (
          <span className="font-mono tabular-nums text-[10px] text-black/60">
            {formatRelativeTime(v, now)}
          </span>
        ) : (
          <span className="text-black/30">—</span>
        )
      },
    },
  ]
}

const ROW_LABELS: Record<AdminActionType, string> = {
  impersonation: 'IMPERSONATION',
  plan_override: 'PLAN OVERRIDE',
  refund: 'REFUND',
  credit: 'CREDIT',
  kill_switch: 'KILL SWITCH',
  flag_change: 'FLAG CHANGE',
  gdpr: 'GDPR',
}

export default async function OperationsPage() {
  const data = await loadOperations()
  const now = Date.now()

  const total = data.history.length
  const pendingCount = data.pending.length
  const activeCount = data.active.length

  // Refund velocity: sum of approved/executed refund amount in last 30d
  const THIRTY_D = 30 * 86_400_000
  const recentRefunds = data.history.filter(
    (r) => r.type === 'refund' && now - r.createdAt < THIRTY_D,
  )
  const refundSum = recentRefunds.reduce((s, r) => s + refundAmountCents(r), 0)
  const refundCount = recentRefunds.length

  // Impersonation history (active + executed)
  const impersonations = data.history.filter((r) => r.type === 'impersonation')
  const writeImp = impersonations.filter((r) => {
    const p = r.params as Record<string, unknown>
    return p['mode'] === 'write'
  }).length
  const readImp = impersonations.length - writeImp

  // Approval latency proxy (median in hours among executed)
  const executed = data.history.filter(
    (r) => r.status === 'executed' || r.status === 'approved',
  )
  const lats = executed
    .map((r) => Math.max(0, r.updatedAt - r.createdAt) / 3_600_000)
    .sort((a, b) => a - b)
  const medianLat =
    lats.length > 0 ? lats[Math.floor(lats.length / 2)] ?? 0 : 0

  const flagChanges = data.byType.flag_change
  const killSwitches = data.byType.kill_switch

  const byTypeRows = (
    Object.keys(ROW_LABELS) as AdminActionType[]
  ).map((k) => ({
    label: ROW_LABELS[k],
    value: data.byType[k],
  }))

  const columns = actionColumns(now)

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 30D" />

      <KpiGrid cols={8}>
        <KpiCard
          label="gov.admin_actions"
          value={formatNumber(total)}
          meta="ALL"
        />
        <KpiCard
          label="REQ PENDING"
          value={formatNumber(pendingCount)}
          meta="QUEUE"
        />
        <KpiCard
          label="APPROVED LIVE"
          value={formatNumber(activeCount)}
          meta="ACTIVE"
        />
        <KpiCard
          label="APR LATENCY P50"
          value={`${medianLat.toFixed(1)}h`}
          meta="MEDIAN"
        />
        <KpiCard
          label="gov.impersonations"
          value={formatNumber(impersonations.length)}
          meta="30D"
        />
        <KpiCard
          label="IMP WRITE"
          value={formatNumber(writeImp)}
          meta="OWNER APR"
        />
        <KpiCard
          label="IMP READ"
          value={formatNumber(readImp)}
          meta="30M URL"
        />
        <KpiCard
          label="REFUND VELOCITY"
          value={formatCents(refundSum)}
          meta="30D"
        />
        <KpiCard
          label="REFUND COUNT"
          value={formatNumber(refundCount)}
          meta="30D"
        />
        <KpiCard
          label="PLAN OVERRIDES"
          value={formatNumber(data.byType.plan_override)}
          meta="ALL"
        />
        <KpiCard
          label="CREDITS"
          value={formatNumber(data.byType.credit)}
          meta="ALL"
        />
        <KpiCard
          label="KILL SWITCH"
          value={formatNumber(killSwitches)}
          meta="ALL"
        />
        <KpiCard
          label="FLAG CHANGES"
          value={formatNumber(flagChanges)}
          meta="ALL"
        />
        <KpiCard
          label="GDPR ACTS"
          value={formatNumber(data.byType.gdpr)}
          meta="ALL"
        />
        <KpiCard
          label="FAIL"
          value={formatNumber(
            data.history.filter((r) => r.status === 'failed').length,
          )}
          meta="STATUS"
        />
        <KpiCard
          label="EXPIRED"
          value={formatNumber(
            data.history.filter((r) => r.status === 'expired').length,
          )}
          meta="STATUS"
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <Panel
          title="PENDING / APPROVAL QUEUE"
          meta={`N=${pendingCount}`}
          className="lg:col-span-2"
        >
          {pendingCount === 0 ? (
            <Empty message="NO PENDING REQUESTS" />
          ) : (
            <DataTable
              data={data.pending}
              columns={columns}
              rowKey={(r) => r.id}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>

        <Panel title="ACTIONS BY TYPE" meta="COUNT">
          <Bars rows={byTypeRows} labelWidth={120} height={18} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <Panel title="ACTIVE / EXECUTED" meta={`N=${activeCount}`}>
          {activeCount === 0 ? (
            <Empty message="NO ACTIVE OPS" />
          ) : (
            <DataTable
              data={data.active.slice(0, 30)}
              columns={columns}
              rowKey={(r) => r.id}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>

        <Panel title="IMPERSONATION HISTORY" meta={`N=${impersonations.length}`}>
          {impersonations.length === 0 ? (
            <Empty message="NO IMPERSONATIONS" />
          ) : (
            <DataTable
              data={impersonations.slice(0, 30)}
              columns={columns}
              rowKey={(r) => r.id}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>

      <div className="mt-3">
        <Panel title="ADMIN ACTIONS LOG" meta={`N=${total}`}>
          <DataTable
            data={data.history}
            columns={columns}
            rowKey={(r) => r.id}
            emptyMessage="NO ACTIONS"
          />
        </Panel>
      </div>
    </>
  )
}
