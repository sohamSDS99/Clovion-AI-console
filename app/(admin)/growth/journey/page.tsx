import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Empty } from '@/components/admin/Empty'
import { Bars } from '@/components/admin/Bars'
import { AreaChart } from '@/components/admin/charts/AreaChart'
import { Sankey, type SankeyNode, type SankeyLink } from '@/components/admin/charts/Sankey'
import { StackedBars } from '@/components/admin/charts/StackedBars'
import { Calendar } from '@/components/admin/charts/Calendar'
import { pageMeta } from '@/lib/admin/content'
import { loadJourney } from '@/lib/admin/queries/journey'
import { formatNumber, formatPercent } from '@/lib/admin/format'
import { paletteAt, paletteForKey, CHART_PALETTE } from '@/lib/admin/palette'

const m = pageMeta['/growth/journey']!

// Per-channel palette (5 channels). Each channel gets a distinct hue so the
// stacked bars read at a glance.
const CHANNEL_COLORS: Record<string, string> = {
  ORGANIC_SEARCH: 'var(--chart-1)',
  PAID_SEARCH: 'var(--chart-6)',
  PAID_SOCIAL: 'var(--chart-5)',
  REFERRAL: 'var(--chart-2)',
  DIRECT: 'var(--chart-3)',
}

export default async function JourneyPage() {
  const data = await loadJourney()

  // Build Sankey props. Override stage colors with palette cycling so each
  // journey stage renders in a distinct hue (the underlying query reuses a
  // single emerald for 6 of the 11 stages).
  const sankeyNodes: SankeyNode[] = data.stages.map((s, i) => ({
    id: s.key,
    label: s.label,
    value: s.count,
    column: s.column,
    color: paletteAt(i),
  }))

  // Add a virtual "drop" sink node at the rightmost column to collect dropoffs
  const dropTotal = data.links
    .filter((l) => l.isDropoff)
    .reduce((s, l) => s + l.value, 0)
  if (dropTotal > 0) {
    sankeyNodes.push({
      id: 'drop',
      label: 'DROP-OFF',
      value: dropTotal,
      column: 11,
      color: 'var(--chart-4)',
    })
  }

  const sankeyLinks: SankeyLink[] = data.links.map((l) => ({
    source: l.source,
    target: l.target,
    value: l.value,
    color: l.isDropoff ? 'var(--chart-4)' : undefined,
  }))

  // TTV: x-axis labels are bucket ceilings, y is count
  const ttvSeries = [
    {
      name: 'ACCOUNTS',
      color: paletteAt(0),
      values: data.ttvBuckets.map((b) => b.count),
    },
  ]
  const ttvLabels = data.ttvBuckets.map((b) =>
    b.bucketHours <= 24 ? `≤${b.bucketHours}H` : `≤${(b.bucketHours / 24).toFixed(0)}D`,
  )

  // Exit points: top 6 by drop-off count
  const exitRows = data.exitPoints.slice(0, 6).map((e) => ({
    label: `${e.fromStage}→${e.toStage}`,
    value: e.exited,
    display: `${formatNumber(e.exited)} · ${formatPercent(e.pctExited, undefined, 1)}`,
  }))

  // Channel mix rows
  const channelRows = data.channelMix.map((row) => ({
    label: row.stage,
    segments: row.segments.map((seg) => ({
      name: seg.name,
      value: seg.value,
      color: CHANNEL_COLORS[seg.name] ?? paletteForKey(seg.name),
    })),
  }))

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 60D" />

      <KpiGrid cols={6} className="mb-4">
        <KpiCard
          label="JNY.VISITORS"
          value={formatNumber(data.kpis.visitors)}
          meta="ANON · 60D"
        />
        <KpiCard
          label="JNY.SIGNUPS"
          value={formatNumber(data.kpis.signups)}
          meta="USER_SIGNED_UP"
        />
        <KpiCard
          label="JNY.ACTIVATIONS"
          value={formatNumber(data.kpis.activations)}
          meta="FIRST RUN"
        />
        <KpiCard
          label="JNY.PAYING"
          value={formatNumber(data.kpis.paying)}
          meta="SUB.ACTIVE"
        />
        <KpiCard
          label="JNY.RETAINED_30D"
          value={formatNumber(data.kpis.retained30d)}
          meta="STILL ACTIVE"
        />
        <KpiCard
          label="JNY.DROP_OFF"
          value={formatPercent(data.kpis.dropoffPct, undefined, 1)}
          meta="VISITOR→ACTIVATED"
        />
      </KpiGrid>

      <Panel
        title="JNY.FLOW · VISITOR → RETAINED"
        meta={`${formatNumber(data.kpis.visitors)} ENTERED · ${formatNumber(
          data.kpis.retained30d,
        )} RETAINED`}
        className="mb-4"
      >
        {data.stages.length ? (
          <Sankey
            nodes={sankeyNodes}
            links={sankeyLinks}
            height={420}
            width={1100}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Panel title="JNY.TIME_TO_ACTIVATION" meta="HOURS BUCKETS">
          {data.ttvBuckets.some((b) => b.count > 0) ? (
            <AreaChart
              series={ttvSeries}
              xLabels={ttvLabels}
              height={200}
              width={640}
              showLegend={false}
              smooth
            />
          ) : (
            <Empty />
          )}
        </Panel>

        <Panel title="JNY.TOP_EXIT_POINTS" meta="STEP-TO-STEP">
          {exitRows.length ? (
            <Bars rows={exitRows} labelWidth={170} height={22} colors={CHART_PALETTE.slice()} />
          ) : (
            <Empty />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="JNY.BY_CHANNEL · STAGE MIX" className="lg:col-span-2">
          {channelRows.length ? (
            <StackedBars rows={channelRows} rowHeight={22} labelWidth={120} />
          ) : (
            <Empty />
          )}
        </Panel>

        <Panel title="JNY.SIGNUPS_DAILY" meta="LAST 60D">
          {data.signupsCalendar.length ? (
            <Calendar values={data.signupsCalendar} color={paletteAt(0)} />
          ) : (
            <Empty />
          )}
        </Panel>
      </div>
    </>
  )
}
