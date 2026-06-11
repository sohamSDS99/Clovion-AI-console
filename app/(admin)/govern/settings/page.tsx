import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { DataTable } from '@/components/admin/DataTable'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadSettings } from '@/lib/admin/queries/settings'
import {
  formatNumber,
  formatRelativeTime,
  formatCents,
  roleLabel,
} from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'
import type { MetricDef } from '@/lib/admin/metrics'

const m = pageMeta['/govern/settings']!

type StaffRow = {
  id: string
  email: string
  name: string
  role: string
  active: boolean
  lastLoginAt: number | null
}

type IntegrationRow = {
  source: string
  lastSyncedAt: number
  lagSeconds: number
  rowsLastRun: number
}

function ActiveBox({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 leading-none ${
        active
          ? 'bg-black text-white'
          : 'border border-black text-black bg-paper'
      }`}
    >
      {active ? 'ACTIVE' : 'OFF'}
    </span>
  )
}

function HealthIndicator({ lagSeconds }: { lagSeconds: number }) {
  // green/solid <= 5m, half <= 30m, hollow > 30m
  const base = 'inline-block w-2 h-2 border border-black'
  if (lagSeconds <= 300) return <span className={`${base} bg-black`} />
  if (lagSeconds <= 1800)
    return (
      <span
        className={base}
        style={{
          background:
            'linear-gradient(to right, #000 0%, #000 50%, #fff 50%, #fff 100%)',
        }}
      />
    )
  return <span className={`${base} bg-paper`} />
}

function staffColumns(now: number): ColumnDef<StaffRow, unknown>[] {
  return [
    {
      header: 'STATE',
      accessorKey: 'active',
      cell: (c) => <ActiveBox active={c.getValue<boolean>()} />,
    },
    {
      header: 'EMAIL',
      accessorKey: 'email',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'NAME',
      accessorKey: 'name',
      cell: (c) => (
        <span className="text-[10.5px] truncate">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'ROLE',
      accessorKey: 'role',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
          {roleLabel(c.getValue<'owner' | 'admin' | 'analyst' | 'support' | 'engineer'>())}
        </span>
      ),
    },
    {
      header: 'LAST LOGIN',
      accessorKey: 'lastLoginAt',
      cell: (c) => {
        const v = c.getValue<number | null>()
        return v ? (
          <span className="font-mono tabular-nums text-[10px] text-black/65">
            {formatRelativeTime(v, now)}
          </span>
        ) : (
          <span className="text-black/30">—</span>
        )
      },
    },
  ]
}

function metricsColumns(): ColumnDef<MetricDef, unknown>[] {
  return [
    {
      header: 'KEY',
      accessorKey: 'key',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'DOMAIN',
      accessorKey: 'domain',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-black/70">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'UNIT',
      accessorKey: 'unit',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-black/70">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'GRAIN',
      accessorKey: 'grain',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-black/65">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'OWNER',
      accessorKey: 'owner',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'VER',
      accessorKey: 'version',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/55">
          v{c.getValue<number>()}
        </span>
      ),
    },
    {
      header: 'DEFINITION',
      accessorKey: 'description',
      cell: (c) => (
        <span className="text-[10px] text-black/65 truncate max-w-[420px] inline-block">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'BENCHMARK',
      id: 'benchmark',
      accessorFn: (r) =>
        r.benchmark ? `${r.benchmark.value} — ${r.benchmark.label}` : '',
      cell: (c) => {
        const v = c.getValue<string>()
        return v ? (
          <span className="font-mono tabular-nums text-[10px] text-black/70">
            {v}
          </span>
        ) : (
          <span className="text-black/30">—</span>
        )
      },
    },
  ]
}

function integrationColumns(now: number): ColumnDef<IntegrationRow, unknown>[] {
  return [
    {
      header: 'STATE',
      accessorKey: 'lagSeconds',
      cell: (c) => <HealthIndicator lagSeconds={c.getValue<number>()} />,
    },
    {
      header: 'SOURCE',
      accessorKey: 'source',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'LAG',
      accessorKey: 'lagSeconds',
      cell: (c) => {
        const v = c.getValue<number>()
        const txt =
          v < 60 ? `${v}s` : v < 3600 ? `${Math.floor(v / 60)}m` : `${Math.floor(v / 3600)}h`
        return (
          <span className="font-mono tabular-nums text-[10px]">{txt}</span>
        )
      },
    },
    {
      header: 'LAST SYNC',
      accessorKey: 'lastSyncedAt',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/65">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
    {
      header: 'ROWS',
      accessorKey: 'rowsLastRun',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/75">
          {formatNumber(c.getValue<number>())}
        </span>
      ),
    },
  ]
}

export default async function SettingsPage() {
  const data = await loadSettings()
  const now = Date.now()

  const staffCount = data.staff.length
  const activeStaff = data.staff.filter((s) => s.active).length
  const owners = data.staff.filter((s) => s.role === 'owner').length
  const admins = data.staff.filter((s) => s.role === 'admin').length
  const analysts = data.staff.filter((s) => s.role === 'analyst').length
  const support = data.staff.filter((s) => s.role === 'support').length
  const engineers = data.staff.filter((s) => s.role === 'engineer').length

  const metricCount = data.metricsCatalog.length
  const anchorCount = data.metricsCatalog.filter((m) => m.anchor).length

  const integrationsCount = data.integrationsHealth.length
  const lagP95 = (() => {
    if (data.integrationsHealth.length === 0) return 0
    const sorted = [...data.integrationsHealth]
      .map((i) => i.lagSeconds)
      .sort((a, b) => a - b)
    const idx = Math.max(0, Math.floor(sorted.length * 0.95) - 1)
    return sorted[idx] ?? 0
  })()
  const greenSync = data.integrationsHealth.filter((i) => i.lagSeconds <= 300).length

  const spendTotal = data.channelSpend.reduce(
    (s, c) => s + c.spendUsdCents,
    0,
  )
  const invoicesTotal = data.providerInvoices.reduce(
    (s, p) => s + p.amountUsdCents,
    0,
  )

  const settingsCount = data.opsSettings.length
  const quartersCount = data.companyInputs.length

  const staffCols = staffColumns(now)
  const metricCols = metricsColumns()
  const integrationCols = integrationColumns(now)

  const channelCols: ColumnDef<typeof data.channelSpend[number], unknown>[] = [
    {
      header: 'MONTH',
      accessorKey: 'month',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'CHANNEL',
      accessorKey: 'channel',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'SPEND',
      accessorKey: 'spendUsdCents',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {formatCents(c.getValue<number>())}
        </span>
      ),
    },
    {
      header: 'SOURCE',
      accessorKey: 'source',
      cell: (c) => (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-black/65">
          {c.getValue<string>()}
        </span>
      ),
    },
  ]

  const invoiceCols: ColumnDef<typeof data.providerInvoices[number], unknown>[] = [
    {
      header: 'PROVIDER',
      accessorKey: 'provider',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'MONTH',
      accessorKey: 'month',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'AMOUNT',
      accessorKey: 'amountUsdCents',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {formatCents(c.getValue<number>())}
        </span>
      ),
    },
    {
      header: 'BY',
      accessorKey: 'enteredBy',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/65 truncate">
          {c.getValue<string>()}
        </span>
      ),
    },
  ]

  const quarterCols: ColumnDef<typeof data.companyInputs[number], unknown>[] = [
    {
      header: 'QUARTER',
      accessorKey: 'quarter',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'S&M EXP',
      accessorKey: 'smExpenseUsdCents',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {formatCents(c.getValue<number>())}
        </span>
      ),
    },
    {
      header: 'GM %',
      accessorKey: 'grossMarginPct',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {c.getValue<number>().toFixed(1)}%
        </span>
      ),
    },
    {
      header: 'FCF %',
      accessorKey: 'fcfMarginPct',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10.5px]">
          {c.getValue<number>().toFixed(1)}%
        </span>
      ),
    },
    {
      header: 'BY',
      accessorKey: 'enteredBy',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/65 truncate">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'AT',
      accessorKey: 'enteredAt',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/60">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
  ]

  const opsCols: ColumnDef<typeof data.opsSettings[number], unknown>[] = [
    {
      header: 'KEY',
      accessorKey: 'key',
      cell: (c) => (
        <span className="font-mono text-[10.5px]">{c.getValue<string>()}</span>
      ),
    },
    {
      header: 'VALUE',
      accessorKey: 'value',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/70 truncate max-w-[280px] inline-block">
          {JSON.stringify(c.getValue<unknown>())}
        </span>
      ),
    },
    {
      header: 'BY',
      accessorKey: 'updatedBy',
      cell: (c) => (
        <span className="font-mono text-[10px] text-black/65 truncate">
          {c.getValue<string>()}
        </span>
      ),
    },
    {
      header: 'AT',
      accessorKey: 'updatedAt',
      cell: (c) => (
        <span className="font-mono tabular-nums text-[10px] text-black/60">
          {formatRelativeTime(c.getValue<number>(), now)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        section={m.section}
        label={m.label}
        meta="STAFF · METRICS · INTEGRATIONS"
      />

      <KpiGrid cols={8}>
        <KpiCard label="STAFF" value={formatNumber(staffCount)} meta="ALL" />
        <KpiCard label="ACTIVE" value={formatNumber(activeStaff)} meta="STAFF" />
        <KpiCard label="OWNER" value={formatNumber(owners)} meta="ROLE" />
        <KpiCard label="ADMIN" value={formatNumber(admins)} meta="ROLE" />
        <KpiCard label="ANALYST" value={formatNumber(analysts)} meta="ROLE" />
        <KpiCard label="SUPPORT" value={formatNumber(support)} meta="ROLE" />
        <KpiCard label="ENGINEER" value={formatNumber(engineers)} meta="ROLE" />
        <KpiCard
          label="METRICS"
          value={formatNumber(metricCount)}
          meta="DICTIONARY"
        />
        <KpiCard label="ANCHORS" value={formatNumber(anchorCount)} meta="KPI" />
        <KpiCard
          label="INTEGRATIONS"
          value={formatNumber(integrationsCount)}
          meta="SOURCES"
        />
        <KpiCard
          label="SYNC GREEN"
          value={formatNumber(greenSync)}
          meta="≤ 5M"
        />
        <KpiCard
          label="LAG P95"
          value={`${Math.floor(lagP95)}s`}
          meta="WATERMARK"
        />
        <KpiCard
          label="CHANNEL SPEND"
          value={formatCents(spendTotal)}
          meta="ALL TIME"
        />
        <KpiCard
          label="PROV INVOICES"
          value={formatCents(invoicesTotal)}
          meta="ALL TIME"
        />
        <KpiCard
          label="OPS SETTINGS"
          value={formatNumber(settingsCount)}
          meta="KEYS"
        />
        <KpiCard
          label="QUARTERS"
          value={formatNumber(quartersCount)}
          meta="INPUTS"
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <Panel title="STAFF USERS" meta={`N=${staffCount} · OWNER-ONLY CRUD`}>
          {staffCount === 0 ? (
            <Empty message="NO STAFF" />
          ) : (
            <DataTable
              data={data.staff}
              columns={staffCols}
              rowKey={(r) => r.id}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>

        <Panel
          title="INTEGRATIONS HEALTH"
          meta={`N=${integrationsCount} · SYNC WATERMARKS`}
        >
          {integrationsCount === 0 ? (
            <Empty message="NO INTEGRATIONS" />
          ) : (
            <DataTable
              data={data.integrationsHealth}
              columns={integrationCols}
              rowKey={(r) => r.source}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>

      <div className="mt-3">
        <Panel
          title="METRIC DICTIONARY"
          meta={`N=${metricCount} · AUTO-RENDERED · READ-ONLY`}
        >
          {metricCount === 0 ? (
            <Empty message="NO METRICS" />
          ) : (
            <DataTable
              data={data.metricsCatalog}
              columns={metricCols}
              rowKey={(r) => r.key}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <Panel
          title="CHANNEL SPEND IMPORT"
          meta={`N=${data.channelSpend.length} · CSV`}
        >
          {data.channelSpend.length === 0 ? (
            <Empty message="NO IMPORTS" />
          ) : (
            <DataTable
              data={data.channelSpend.slice(0, 50)}
              columns={channelCols}
              rowKey={(r, i) => `${r.month}-${r.channel}-${i}`}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>

        <Panel
          title="PROVIDER INVOICE RECON"
          meta={`N=${data.providerInvoices.length}`}
        >
          {data.providerInvoices.length === 0 ? (
            <Empty message="NO INVOICES" />
          ) : (
            <DataTable
              data={data.providerInvoices.slice(0, 50)}
              columns={invoiceCols}
              rowKey={(r, i) => `${r.provider}-${r.month}-${i}`}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <Panel
          title="COMPANY INPUTS / QUARTERLY"
          meta={`N=${data.companyInputs.length}`}
        >
          {data.companyInputs.length === 0 ? (
            <Empty message="NO QUARTERS" />
          ) : (
            <DataTable
              data={data.companyInputs}
              columns={quarterCols}
              rowKey={(r) => r.quarter}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>

        <Panel title="OPS SETTINGS" meta={`N=${settingsCount}`}>
          {settingsCount === 0 ? (
            <Empty message="NO SETTINGS" />
          ) : (
            <DataTable
              data={data.opsSettings}
              columns={opsCols}
              rowKey={(r) => r.key}
              emptyMessage="EMPTY"
            />
          )}
        </Panel>
      </div>
    </>
  )
}
