'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@/components/admin/DataTable'
import { DataTable } from '@/components/admin/DataTable'
import { Badge } from '@/components/admin/Badge'
import { cn } from '@/lib/cn'
import {
  formatCents,
  formatNumber,
  formatPercent,
  planLabel,
} from '@/lib/admin/format'
import type { AccountListRow } from '@/lib/admin/queries/accounts'

type PlanFilter = 'all' | 'free' | 'starter' | 'growth' | 'enterprise'
type TypeFilter = 'all' | 'brand' | 'agency'
type StatusFilter = 'all' | 'active' | 'trialing' | 'churned'

export function AccountsTable({ rows }: { rows: AccountListRow[] }) {
  const [q, setQ] = useState('')
  const [plan, setPlan] = useState<PlanFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (plan !== 'all' && r.planTier !== plan) return false
      if (type !== 'all' && r.type !== type) return false
      if (status !== 'all' && r.status !== status) return false
      if (needle && !(r.name.toLowerCase().includes(needle) || r.id.toLowerCase().includes(needle)))
        return false
      return true
    })
  }, [rows, q, plan, type, status])

  const columns = useMemo<ColumnDef<AccountListRow, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'ACCOUNT',
        cell: ({ row }) => (
          <Link
            href={`/accounts/${row.original.id}`}
            className="font-mono text-[11px] uppercase tracking-[0.04em] underline-offset-2 hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: 'id',
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-[10px] text-black/55">
            {row.original.id}
          </span>
        ),
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: 'TYPE',
        cell: ({ row }) => (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
            {row.original.type.toUpperCase()}
          </span>
        ),
      },
      {
        id: 'plan',
        accessorKey: 'planTier',
        header: 'PLAN',
        cell: ({ row }) => (
          <Badge variant={row.original.planTier === 'enterprise' ? 'solid' : 'outline'}>
            {planLabel(row.original.planTier as any)}
          </Badge>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }) => {
          const s = row.original.status
          // B&W status: active=solid, trialing=half, churned=hollow
          return (
            <span className="inline-flex items-center gap-1.5">
              <StatusBox status={s} />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em]">
                {s.toUpperCase()}
              </span>
            </span>
          )
        },
      },
      {
        id: 'mrr',
        accessorKey: 'mrrUsdCents',
        header: 'MRR',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-[11px] text-right block">
            {formatCents(row.original.mrrUsdCents)}
          </span>
        ),
      },
      {
        id: 'workspaces',
        accessorKey: 'workspaceCount',
        header: 'WS',
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-[11px]">
            {formatNumber(row.original.workspaceCount)}
          </span>
        ),
      },
      {
        id: 'margin',
        accessorKey: 'marginUsdCents',
        header: 'MARGIN 14D',
        cell: ({ row }) => {
          const v = row.original.marginUsdCents
          return (
            <span
              className={cn(
                'font-mono tabular-nums text-[11px]',
                v < 0 ? 'underline decoration-2' : ''
              )}
            >
              {formatCents(v)}
            </span>
          )
        },
      },
      {
        id: 'risk',
        accessorKey: 'churnRiskScore',
        header: 'RISK',
        cell: ({ row }) => {
          const v = row.original.churnRiskScore
          return (
            <span className="inline-flex items-center gap-2">
              <div className="relative bg-black/5 w-16 h-2">
                <div
                  className="absolute inset-y-0 left-0 bg-black"
                  style={{ width: `${Math.min(100, v)}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-[10px] w-6 text-right">
                {formatNumber(v)}
              </span>
            </span>
          )
        },
      },
    ],
    []
  )

  return (
    <div className="border border-black/15 bg-paper">
      <div className="flex flex-wrap items-center gap-3 border-b border-black/10 px-3 py-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SEARCH NAME / ID"
          className="font-mono text-[11px] uppercase tracking-[0.08em] bg-paper border border-black/20 px-2 py-1 w-[220px] placeholder:text-black/35 focus:outline-none focus:border-black"
        />
        <FilterSelect
          label="PLAN"
          value={plan}
          onChange={(v) => setPlan(v as PlanFilter)}
          options={[
            ['all', 'ALL'],
            ['free', 'FREE'],
            ['starter', 'STARTER'],
            ['growth', 'GROWTH'],
            ['enterprise', 'ENT'],
          ]}
        />
        <FilterSelect
          label="TYPE"
          value={type}
          onChange={(v) => setType(v as TypeFilter)}
          options={[
            ['all', 'ALL'],
            ['brand', 'BRAND'],
            ['agency', 'AGENCY'],
          ]}
        />
        <FilterSelect
          label="STATUS"
          value={status}
          onChange={(v) => setStatus(v as StatusFilter)}
          options={[
            ['all', 'ALL'],
            ['active', 'ACTIVE'],
            ['trialing', 'TRIALING'],
            ['churned', 'CHURNED'],
          ]}
        />
        <span className="ml-auto font-mono tabular-nums text-[10px] uppercase tracking-[0.10em] text-black/55">
          {formatNumber(filtered.length)} / {formatNumber(rows.length)}
        </span>
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="NO MATCHES"
        initialSorting={[{ id: 'mrr', desc: true }]}
        rowKey={(r) => r.id}
      />
    </div>
  )
}

function StatusBox({ status }: { status: string }) {
  const base = 'inline-block w-2.5 h-2.5 border border-black'
  if (status === 'active') return <span className={cn(base, 'bg-black')} aria-label="active" />
  if (status === 'trialing')
    return (
      <span
        className={base}
        aria-label="trialing"
        style={{
          background:
            'linear-gradient(to right, #000 0%, #000 50%, #fff 50%, #fff 100%)',
        }}
      />
    )
  return <span className={cn(base, 'bg-paper')} aria-label="churned" />
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: Array<[T, string]>
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-black/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="font-mono text-[10px] uppercase tracking-[0.08em] bg-paper border border-black/20 px-1.5 py-1 focus:outline-none focus:border-black"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}
