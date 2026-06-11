import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { DataTable } from '@/components/admin/DataTable'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadAudit, type AuditRow } from '@/lib/admin/queries/audit'
import { formatNumber, formatRelativeTime } from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'

const m = pageMeta['/audit']!

function hashShort(h: string): string {
  if (!h) return '—'
  return h.slice(0, 8)
}

function ChainVerifyBadge({ ok, total }: { ok: boolean; total: number }) {
  const cls = ok
    ? 'bg-black text-white'
    : 'border border-black text-black bg-paper'
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em] tabular-nums px-2 py-1 leading-none ${cls}`}
    >
      <span aria-hidden="true">{ok ? '◼' : '○'}</span>
      <span>{ok ? 'CHAIN VERIFIED' : 'CHAIN BREAK'}</span>
      <span className="opacity-60">N={total}</span>
    </span>
  )
}

function auditColumns(now: number): ColumnDef<AuditRow, unknown>[] {
  return [
    {
      header: 'ID',
      accessorKey: 'id',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/45">
          #{c.getValue<number>()}
        </span>
      ),
    },
    {
      header: 'AT',
      accessorKey: 'at',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/65">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
    {
      header: 'ACTOR',
      accessorFn: (r) => r.actorEmail ?? r.actorStaffId,
      cell: (c) => (
        <span className="font-mono text-[10px] truncate">
          {c.getValue<string>() || '—'}
        </span>
      ),
    },
    {
      header: 'ROLE',
      accessorKey: 'actorRole',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-black/70">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'ACTION',
      accessorKey: 'action',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'OBJECT',
      accessorFn: (r) => `${r.objectType}:${r.objectId}`,
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70 truncate">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'REASON',
      accessorKey: 'reason',
      cell: (c) => (
        <span className="text-[10px] text-black/55 truncate max-w-[220px] inline-block">
          {c.getValue<string>() || '—'}
        </span>
      ),
    },
    {
      header: 'IP',
      accessorKey: 'ip',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/55">
          {c.getValue<string>() || '—'}
        </span>
      ),
    },
    {
      header: 'PREV',
      accessorKey: 'prevHash',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/45">
          {hashShort(c.getValue<string>())}
        </span>
      ),
    },
    {
      header: 'HASH',
      accessorKey: 'hash',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70">
          {hashShort(c.getValue<string>())}
        </span>
      ),
    },
    {
      header: 'DIFF',
      id: 'diff',
      cell: () => (
        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] border border-black/40 px-1 py-0.5 text-black/70">
          {'<>'}
        </span>
      ),
    },
  ]
}

export default async function AuditPage() {
  const { rows, total } = await loadAudit({ limit: 200 })
  const now = Date.now()

  // Verify hash chain integrity client-side (cheap: each row.prevHash must match prior row.hash in time order)
  const ordered = [...rows].sort((a, b) => a.id - b.id)
  let chainOk = true
  let breakAtId: number | null = null
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i]!.prevHash !== ordered[i - 1]!.hash) {
      chainOk = false
      breakAtId = ordered[i]!.id
      break
    }
  }

  // Aggregate by action
  const byAction = new Map<string, number>()
  for (const r of rows) byAction.set(r.action, (byAction.get(r.action) ?? 0) + 1)
  const actionRows = Array.from(byAction.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  // Aggregate by actor
  const byActor = new Map<string, number>()
  for (const r of rows) {
    const k = r.actorEmail ?? r.actorStaffId
    byActor.set(k, (byActor.get(k) ?? 0) + 1)
  }
  const actorRows = Array.from(byActor.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  const piiReveals = rows.filter((r) => r.action.includes('pii_reveal')).length
  const last24h = rows.filter((r) => now - r.at < 86_400_000).length
  const last7d = rows.filter((r) => now - r.at < 7 * 86_400_000).length
  const last30d = rows.filter((r) => now - r.at < 30 * 86_400_000).length
  const actors = byActor.size

  const flagChanges = byAction.get('flag_change') ?? 0
  const impersonations = byAction.get('impersonation_approved') ?? 0
  const refunds = byAction.get('refund_issued') ?? 0

  const columns = auditColumns(now)

  return (
    <>
      <PageHeader
        section={m.section}
        label={m.label}
        meta="HASH-CHAINED · APPEND-ONLY"
        right={<ChainVerifyBadge ok={chainOk} total={total} />}
      />

      <KpiGrid cols={8}>
        <KpiCard label="gov.audit_chain" value={chainOk ? 'PASS' : 'FAIL'} meta="WEEKLY" />
        <KpiCard label="ENTRIES" value={formatNumber(total)} meta="TOTAL" />
        <KpiCard label="LAST 24H" value={formatNumber(last24h)} meta="ROWS" />
        <KpiCard label="LAST 7D" value={formatNumber(last7d)} meta="ROWS" />
        <KpiCard label="LAST 30D" value={formatNumber(last30d)} meta="ROWS" />
        <KpiCard label="DISTINCT ACTORS" value={formatNumber(actors)} meta="STAFF" />
        <KpiCard
          label="gov.pii_reveals"
          value={formatNumber(piiReveals)}
          meta="200 LIM"
        />
        <KpiCard label="FLAG CHANGE" value={formatNumber(flagChanges)} meta="ACTION" />
        <KpiCard label="IMP APPROVED" value={formatNumber(impersonations)} meta="ACTION" />
        <KpiCard label="REFUND ISSUED" value={formatNumber(refunds)} meta="ACTION" />
        <KpiCard
          label="CHAIN BREAK"
          value={breakAtId !== null ? `#${breakAtId}` : 'NONE'}
          meta={chainOk ? 'OK' : 'ALERT'}
        />
        <KpiCard
          label="MONTHLY EXPORT"
          value={'BUCKET'}
          meta="CRON 0 13"
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <Panel title="ACTIONS BY TYPE" meta={`TOP ${actionRows.length}`}>
          {actionRows.length === 0 ? (
            <Empty message="NO ACTIONS" />
          ) : (
            <Bars rows={actionRows} labelWidth={140} height={18} />
          )}
        </Panel>

        <Panel title="ACTIONS BY ACTOR" meta={`TOP ${actorRows.length}`}>
          {actorRows.length === 0 ? (
            <Empty message="NO ACTORS" />
          ) : (
            <Bars rows={actorRows} labelWidth={180} height={18} />
          )}
        </Panel>
      </div>

      <div className="mt-3">
        <Panel
          title="AUDIT LOG"
          meta={`N=${rows.length} OF ${total} · HASH SHA-256`}
        >
          {rows.length === 0 ? (
            <Empty message="NO AUDIT ROWS" />
          ) : (
            <DataTable
              data={rows}
              columns={columns}
              rowKey={(r) => String(r.id)}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>
    </>
  )
}
