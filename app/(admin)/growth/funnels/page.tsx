import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Funnel } from '@/components/admin/Funnel'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { Badge } from '@/components/admin/Badge'
import { pageMeta } from '@/lib/admin/content'
import { loadFunnelList, loadFunnel } from '@/lib/admin/queries/funnels'
import { formatNumber, formatPercent } from '@/lib/admin/format'

const m = pageMeta['/growth/funnels']!

type FunnelsPageProps = {
  searchParams?: { funnel?: string }
}

export default async function FunnelsPage({ searchParams }: FunnelsPageProps) {
  const list = await loadFunnelList()
  const selectedId = searchParams?.funnel
  const selected = selectedId ? await loadFunnel(selectedId) : null

  const totalFunnels = list.length
  const activeFunnels = list.filter((f) => f.active).length
  const accountScoped = list.filter((f) => f.scope === 'account').length
  const userScoped = list.filter((f) => f.scope === 'user').length

  return (
    <>
      <PageHeader
        section={m.section}
        label={m.label}
        meta={`${totalFunnels} FUNNELS · LAST 28D`}
      />

      <KpiGrid cols={6} className="mb-4">
        <KpiCard
          label="FUNNEL.TOTAL"
          value={formatNumber(totalFunnels)}
          meta="DEFINED"
        />
        <KpiCard
          label="FUNNEL.ACTIVE"
          value={formatNumber(activeFunnels)}
          meta="LIVE"
        />
        <KpiCard
          label="SCOPE.ACCOUNT"
          value={formatNumber(accountScoped)}
          meta="FUNNELS"
        />
        <KpiCard
          label="SCOPE.USER"
          value={formatNumber(userScoped)}
          meta="FUNNELS"
        />
        <KpiCard
          label="WINDOW.MEDIAN"
          value={`${
            list.length
              ? list
                  .map((f) => f.windowHours)
                  .sort((a, b) => a - b)[Math.floor(list.length / 2)]
              : 0
          }h`}
          meta="HOURS"
        />
        <KpiCard
          label="VERSION.MAX"
          value={`v${
            list.length ? Math.max(...list.map((f) => f.version)) : 1
          }`}
          meta="LATEST"
        />
      </KpiGrid>

      {selected ? (
        <Panel
          title={`FUNNEL · ${selected.funnelId.toUpperCase()}`}
          meta={`${selected.scope.toUpperCase()} · ${selected.windowHours}H · v${selected.version}`}
          className="mb-4"
        >
          {selected.stepResults.length ? (
            <Funnel
              steps={selected.stepResults.map((s) => ({
                name: s.step.replace(/_/g, ' '),
                entered: s.entered,
                completed: s.completed,
                conversionPct: s.conversionPct * 100,
              }))}
              labelWidth={240}
            />
          ) : (
            <Empty />
          )}
        </Panel>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {list.length === 0 ? (
          <Panel title="FUNNELS · EMPTY" className="lg:col-span-2">
            <Empty />
          </Panel>
        ) : (
          list.map((f) => (
            <FunnelCard key={f.funnelId} funnelId={f.funnelId} def={f} />
          ))
        )}
      </div>
    </>
  )
}

async function FunnelCard({
  funnelId,
  def,
}: {
  funnelId: string
  def: {
    funnelId: string
    name: string
    steps: string[]
    windowHours: number
    scope: 'user' | 'account'
    active: boolean
    version: number
  }
}) {
  const detail = await loadFunnel(funnelId)

  const overallEntered = detail?.stepResults[0]?.entered ?? 0
  const overallCompleted =
    detail?.stepResults[detail.stepResults.length - 1]?.completed ?? 0
  const overallCvr = overallEntered ? overallCompleted / overallEntered : 0

  const meta = [
    def.scope.toUpperCase(),
    `${def.windowHours}H`,
    `v${def.version}`,
    def.active ? 'ACTIVE' : 'INACTIVE',
  ].join(' · ')

  const stepBars =
    detail?.stepResults.map((s) => ({
      label: s.step.replace(/_/g, ' '),
      value: s.entered,
      display: `${formatNumber(s.entered)}→${formatNumber(
        s.completed,
      )} · ${formatPercent(s.conversionPct, undefined, 1)}`,
    })) ?? []

  return (
    <Panel
      title={def.funnelId.toUpperCase()}
      meta={meta}
      right={
        <Badge variant={def.active ? 'solid' : 'outline'}>
          {formatPercent(overallCvr, undefined, 1)}
        </Badge>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums text-black/55 uppercase tracking-[0.1em]">
          <span>{def.name}</span>
        </div>
        {stepBars.length ? (
          <Bars rows={stepBars} labelWidth={180} height={16} />
        ) : (
          <Empty />
        )}
      </div>
    </Panel>
  )
}
