import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { Bars } from '@/components/admin/Bars'
import { Sparkline } from '@/components/admin/Sparkline'
import { Badge } from '@/components/admin/Badge'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadSupport } from '@/lib/admin/queries/support'
import {
  formatNumber,
  formatPercent,
  formatDuration,
} from '@/lib/admin/format'

const m = pageMeta['/support']!

function last(series: Array<{ value: number }>): number {
  return series.length > 0 ? series[series.length - 1].value : 0
}

function sum(series: Array<{ value: number }>, n: number): number {
  return series.slice(-n).reduce((s, p) => s + p.value, 0)
}

function avg(series: Array<{ value: number }>, n: number): number {
  if (series.length === 0) return 0
  const tail = series.slice(-n)
  return tail.reduce((s, p) => s + p.value, 0) / tail.length
}

function values(series: Array<{ value: number }>, n = 28): number[] {
  return series.slice(-n).map((p) => p.value)
}

function deltaPctVs(curr: number, prev: number): {
  pct: number
  dir: 'up' | 'down' | 'flat'
} {
  if (!prev) return { pct: 0, dir: 'flat' }
  const d = (curr - prev) / Math.abs(prev)
  return {
    pct: Math.abs(d * 100),
    dir: Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down',
  }
}

export default async function SupportPage() {
  const d = await loadSupport()

  const tickets28 = sum(d.ticketsSeries, 28)
  const tickets7 = sum(d.ticketsSeries, 7)
  const ticketsPrev7 = sum(d.ticketsSeries.slice(0, -7), 7)

  const frtMedianMin = avg(d.frtSeries, 7)
  const frtPrev = avg(d.frtSeries.slice(0, -7), 7)
  const csatLatest = last(d.csatSeries)
  const csatPrev = avg(d.csatSeries.slice(0, -1), 3)

  const backlogTotal = d.backlogByAge.reduce((s, b) => s + b.count, 0)
  const over7d = d.backlogByAge.find((b) => b.bucket === '>7d')?.count ?? 0

  const nps = d.nps
  const promPct = nps.responses ? (nps.promoters / nps.responses) * 100 : 0
  const passPct = nps.responses ? (nps.passives / nps.responses) * 100 : 0
  const detPct = nps.responses ? (nps.detractors / nps.responses) * 100 : 0

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 28D · INTERNAL BASELINES" />

      <KpiGrid cols={8} className="mb-3">
        <KpiCard
          label="TICKETS 28D"
          value={formatNumber(tickets28)}
          spark={values(d.ticketsSeries)}
        />
        <KpiCard
          label="TICKETS 7D"
          value={formatNumber(tickets7)}
          delta={deltaPctVs(tickets7, ticketsPrev7)}
          spark={values(d.ticketsSeries, 14)}
        />
        <KpiCard
          label="FRT MEDIAN"
          value={formatDuration(frtMedianMin * 60_000)}
          delta={deltaPctVs(frtMedianMin, frtPrev)}
          spark={values(d.frtSeries)}
          meta="MINUTES"
        />
        <KpiCard
          label="RESOLUTION"
          value={formatDuration(18 * 3_600_000)}
          meta="MEDIAN HOURS"
        />
        <KpiCard
          label="BACKLOG OPEN"
          value={formatNumber(backlogTotal)}
        />
        <KpiCard
          label="BACKLOG >7D"
          value={formatNumber(over7d)}
          meta={over7d > 0 ? 'ALERT' : 'OK'}
        />
        <KpiCard
          label="CSAT"
          value={formatPercent(csatLatest * 100, undefined, 1)}
          delta={deltaPctVs(csatLatest, csatPrev)}
          spark={values(d.csatSeries)}
          meta="≥80% FLOOR"
        />
        <KpiCard
          label="NPS"
          value={`${nps.score > 0 ? '+' : ''}${nps.score}`}
          meta={`N=${nps.responses}`}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Panel title="TICKET VOLUME · 28D" meta="SUP.TICKETS">
          {d.ticketsSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <span className="font-mono tabular-nums text-[18px] font-semibold">
                  {formatNumber(tickets28)}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45">
                  NEW / DAY
                </span>
              </div>
              <Sparkline values={values(d.ticketsSeries)} width={420} height={48} />
            </div>
          )}
        </Panel>

        <Panel title="FRT · MEDIAN MINUTES · 28D" meta="SUP.FRT">
          {d.frtSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <span className="font-mono tabular-nums text-[18px] font-semibold">
                  {formatDuration(frtMedianMin * 60_000)}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45">
                  TARGET ≤2X BASELINE
                </span>
              </div>
              <Sparkline values={values(d.frtSeries)} width={420} height={48} />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Panel title="BACKLOG BY AGE" meta="SUP.BACKLOG">
          {d.backlogByAge.length === 0 ? (
            <Empty />
          ) : (
            <Bars
              rows={d.backlogByAge.map((b) => ({
                label: b.bucket,
                value: b.count,
                display: formatNumber(b.count),
              }))}
              labelWidth={70}
            />
          )}
        </Panel>

        <Panel title="BY PRIORITY" meta="OPEN+CLOSED">
          {d.byPriority.length === 0 ? (
            <Empty />
          ) : (
            <Bars
              rows={d.byPriority.map((b) => ({
                label: b.priority.toUpperCase(),
                value: b.count,
                display: formatNumber(b.count),
              }))}
              labelWidth={80}
            />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <Panel title="CSAT TREND" meta="MONTHLY · SUP.CSAT">
          {d.csatSeries.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-end justify-between">
                <span className="font-mono tabular-nums text-[18px] font-semibold">
                  {formatPercent(csatLatest * 100, undefined, 1)}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45">
                  4-5 / RESP
                </span>
              </div>
              <Sparkline values={values(d.csatSeries)} width={300} height={42} />
            </div>
          )}
        </Panel>

        <Panel title="NPS DISTRIBUTION" meta={`N=${nps.responses}`}>
          <div className="flex flex-col gap-2">
            <Bars
              rows={[
                {
                  label: 'PROMOTERS 9-10',
                  value: nps.promoters,
                  max: nps.responses || 1,
                  display: `${formatNumber(nps.promoters)} · ${formatPercent(promPct, undefined, 0)}`,
                },
                {
                  label: 'PASSIVES 7-8',
                  value: nps.passives,
                  max: nps.responses || 1,
                  display: `${formatNumber(nps.passives)} · ${formatPercent(passPct, undefined, 0)}`,
                },
                {
                  label: 'DETRACTORS 0-6',
                  value: nps.detractors,
                  max: nps.responses || 1,
                  display: `${formatNumber(nps.detractors)} · ${formatPercent(detPct, undefined, 0)}`,
                },
              ]}
              labelWidth={130}
            />
            <div className="border-t border-black/10 mt-1 pt-2 flex items-center justify-between">
              <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55">
                SCORE
              </span>
              <span className="font-mono tabular-nums text-[18px] font-semibold">
                {nps.score > 0 ? '+' : ''}
                {nps.score}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="NPS VERBATIMS" meta="LATEST">
          {nps.verbatims.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
              {nps.verbatims.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                  <Badge variant={v.score >= 9 ? 'solid' : v.score >= 7 ? 'outline' : 'ghost'}>
                    {String(v.score).padStart(2, '0')}
                  </Badge>
                  <span className="text-black/80 truncate" title={v.comment}>
                    {v.comment}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
