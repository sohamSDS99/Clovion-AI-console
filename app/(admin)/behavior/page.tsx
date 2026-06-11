import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { DataTable } from '@/components/admin/DataTable'
import { Badge } from '@/components/admin/Badge'
import { Empty } from '@/components/admin/Empty'
import { AreaChart } from '@/components/admin/charts/AreaChart'
import { Matrix } from '@/components/admin/charts/Matrix'
import { Sankey } from '@/components/admin/charts/Sankey'
import { TaperedFunnel } from '@/components/admin/charts/TaperedFunnel'
import { pageMeta } from '@/lib/admin/content'
import { loadBehavior } from '@/lib/admin/queries/behavior'
import { paletteFor } from '@/lib/admin/queries/behavior'
import type { FeatureRow, LifecycleStage } from '@/lib/admin/queries/behavior'
import { formatNumber, formatPercent } from '@/lib/admin/format'
import type { ColumnDef } from '@/components/admin/DataTable'
import type { BadgeVariant } from '@/components/admin/Badge'

const m = pageMeta['/behavior']!

const NUM_CELL = 'font-mono tabular-nums text-right block'

const STAGE_VARIANT: Record<LifecycleStage, BadgeVariant> = {
  intro: 'outline',
  growing: 'solid',
  mature: 'ghost',
  declining: 'outline',
}

function StageBadge({ stage }: { stage: LifecycleStage }) {
  const variant = STAGE_VARIANT[stage]
  return (
    <Badge
      variant={variant}
      className={stage === 'declining' ? 'italic' : ''}
    >
      {stage.toUpperCase()}
    </Badge>
  )
}

function MoMCell({ value }: { value: number }) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  const display =
    value === 0 ? '0.0%' : `${sign}${Math.abs(value * 100).toFixed(1)}%`
  return <span className={NUM_CELL}>{display}</span>
}

function TransitionsCell({
  transitions,
}: {
  transitions: FeatureRow['transitions']
}) {
  if (transitions.length === 0) {
    return <span className="text-black/30 font-mono">—</span>
  }
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.10em] text-black/70">
      {transitions
        .map((t) => `${t.toLabel} (${formatNumber(t.users)})`)
        .join(' · ')}
    </span>
  )
}

export default async function BehaviorPage() {
  const data = await loadBehavior()
  const {
    features,
    allFeaturesIntensityMatrix,
    transitionSankey,
    featuresTracked,
    topFeatureLabel,
    topFeaturePct,
    lowestFeatureLabel,
    lowestFeaturePct,
    meanFeaturesPerAccount,
    habitFeaturesCount,
  } = data

  const columns: ColumnDef<FeatureRow>[] = [
    {
      id: 'feature',
      accessorKey: 'label',
      header: 'FEATURE',
      cell: ({ row }) => (
        <span className="font-mono uppercase tracking-[0.10em] text-[10px] text-left flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block w-2 h-2"
            style={{ background: row.original.color }}
          />
          {row.original.label}
        </span>
      ),
    },
    {
      id: 'stage',
      accessorKey: 'stage',
      header: 'STAGE',
      cell: ({ row }) => <StageBadge stage={row.original.stage} />,
    },
    {
      id: 'dau28',
      accessorKey: 'dau28',
      header: <span className="block text-right">DAU 28D</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatNumber(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'newAdoptionsLast7d',
      accessorKey: 'newAdoptionsLast7d',
      header: <span className="block text-right">NEW 7D</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>{formatNumber(Number(getValue() ?? 0))}</span>
      ),
    },
    {
      id: 'momTrend',
      accessorKey: 'momTrend',
      header: <span className="block text-right">MoM</span>,
      cell: ({ getValue }) => <MoMCell value={Number(getValue() ?? 0)} />,
    },
    {
      id: 'habitPct',
      accessorKey: 'habitPct',
      header: <span className="block text-right">HABIT %</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
    {
      id: 'expertPct',
      accessorKey: 'expertPct',
      header: <span className="block text-right">EXPERT %</span>,
      cell: ({ getValue }) => (
        <span className={NUM_CELL}>
          {formatPercent(Number(getValue() ?? 0), undefined, 1)}
        </span>
      ),
    },
    {
      id: 'transitions',
      header: 'NEXT FEATURES',
      cell: ({ row }) => (
        <TransitionsCell transitions={row.original.transitions} />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        section={m.section}
        label={m.label}
        meta={m.meta?.toUpperCase()}
      />

      <KpiGrid cols={6} className="mb-4">
        <KpiCard label="FEATURES" value={String(featuresTracked)} />
        <KpiCard
          label="TOP ADOPTED"
          value={topFeatureLabel}
          meta={formatPercent(topFeaturePct, undefined, 1)}
        />
        <KpiCard
          label="LOWEST"
          value={lowestFeatureLabel}
          meta={formatPercent(lowestFeaturePct, undefined, 1)}
        />
        <KpiCard
          label="MEAN / ACCT"
          value={meanFeaturesPerAccount.toFixed(1)}
        />
        <KpiCard
          label="HABIT FEATURES"
          value={String(habitFeaturesCount)}
          meta=">=5x/28d"
        />
      </KpiGrid>

      <Panel
        title="FEATURE LIFECYCLE"
        meta={`${features.length} tracked`}
        padding="none"
        className="mb-4"
      >
        {features.length ? (
          <DataTable<FeatureRow>
            data={features}
            columns={columns}
            rowKey={(r) => r.key}
            initialSorting={[{ id: 'dau28', desc: true }]}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        title="FEATURE LIFECYCLE FUNNELS"
        meta="discovery -> first use -> repeat -> habit -> expert"
        padding="none"
        className="mb-4"
      >
        <div className="grid grid-cols-3 gap-4 p-3">
          {features.map((f) => (
            <div key={f.key} className="border border-black/10 p-2">
              <div className="text-[9.5px] uppercase tracking-[0.12em] opacity-55 mb-1 font-mono">
                {f.label}
              </div>
              <TaperedFunnel
                steps={f.funnelSteps}
                color={paletteFor(f.key)}
                width={220}
                stepHeight={28}
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="FEATURE INTENSITY · 28D"
        meta="cell = uses per day"
        className="mb-4"
      >
        {allFeaturesIntensityMatrix.rows.length ? (
          <Matrix
            rows={allFeaturesIntensityMatrix.rows}
            cols={allFeaturesIntensityMatrix.cols}
            values={allFeaturesIntensityMatrix.values}
            max={allFeaturesIntensityMatrix.max}
            cellSize={14}
            legend
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        title="FEATURE TRANSITION · NEXT-USED"
        meta="users who adopted X also adopted Y"
        className="mb-4"
      >
        {transitionSankey.nodes.length ? (
          <Sankey
            nodes={transitionSankey.nodes}
            links={transitionSankey.links}
            height={300}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        title="RETENTION BY FEATURE · DAY 0-30"
        meta="first-time users"
        padding="none"
      >
        <div className="grid grid-cols-3 gap-4 p-3">
          {features.map((f) => (
            <div key={f.key} className="border border-black/10 p-2">
              <div className="text-[9.5px] uppercase tracking-[0.12em] opacity-55 mb-1 font-mono">
                {f.label}
              </div>
              <AreaChart
                series={[
                  { name: f.label, color: paletteFor(f.key), values: f.retentionCurve },
                ]}
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
