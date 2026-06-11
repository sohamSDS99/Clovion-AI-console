import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Panel } from '@/components/admin/Panel'
import { Sparkline } from '@/components/admin/Sparkline'
import { Badge } from '@/components/admin/Badge'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { pageMeta } from '@/lib/admin/content'
import { loadAccount360 } from '@/lib/admin/queries/accounts'
import {
  formatCents,
  formatMicrocents,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatDuration,
  planLabel,
} from '@/lib/admin/format'
import { cn } from '@/lib/cn'

const base = pageMeta['/customers/accounts']!

function maskEmail(e: string): string {
  const [u, d] = e.split('@')
  if (!d) return e
  return `${u.slice(0, 1)}•••@${d.slice(0, 1)}•••.${d.split('.').pop()}`
}

function StatusBox({ status }: { status: string }) {
  const cls = 'inline-block w-2.5 h-2.5 border border-black'
  if (status === 'active' || status === 'paid' || status === 'success' || status === 'green')
    return <span className={cn(cls, 'bg-black')} />
  if (
    status === 'trialing' ||
    status === 'pending' ||
    status === 'open' ||
    status === 'amber' ||
    status === 'past_due'
  )
    return (
      <span
        className={cls}
        style={{
          background:
            'linear-gradient(to right, #000 0%, #000 50%, #fff 50%, #fff 100%)',
        }}
      />
    )
  return <span className={cn(cls, 'bg-paper')} />
}

function freshnessState(lastRunAt: number | null, now: number): 'green' | 'amber' | 'red' {
  if (!lastRunAt) return 'red'
  const ageH = (now - lastRunAt) / 3_600_000
  if (ageH <= 26) return 'green'
  if (ageH <= 48) return 'amber'
  return 'red'
}

function FreshIndicator({ state }: { state: 'green' | 'amber' | 'red' }) {
  const base = 'inline-block w-2 h-2 border border-black'
  if (state === 'green') return <span className={cn(base, 'bg-black')} />
  if (state === 'amber')
    return (
      <span
        className={base}
        style={{
          background:
            'linear-gradient(to right, #000 0%, #000 50%, #fff 50%, #fff 100%)',
        }}
      />
    )
  return <span className={cn(base, 'bg-paper')} />
}

type TimelineEvent = {
  at: number
  kind: 'SUB' | 'ADMIN' | 'INVOICE' | 'TICKET' | 'NPS'
  title: string
  detail?: string
}

export default async function AccountDetailPage({ params }: { params: { id: string } }) {
  const d = await loadAccount360(params.id)
  if (!d) notFound()

  const a = d.account
  const sub = d.subscription
  const now = Date.now()

  const dauValues = d.dauSparkline.map((p) => p.dau)
  const dau7 = dauValues.slice(-7)
  const dau28 = dauValues.slice(-28)
  const dauAvg7 = dau7.length ? dau7.reduce((s, v) => s + v, 0) / dau7.length : 0
  const dauAvg28 = dau28.length ? dau28.reduce((s, v) => s + v, 0) / dau28.length : 0
  const stickiness = dauAvg28 > 0 ? dauAvg7 / dauAvg28 : 0

  // Risk factors
  const factors: Array<{ label: string; weight: number; on: boolean }> = [
    {
      label: 'NPS DETRACTOR',
      weight: 20,
      on: d.nps.some((n) => n.score <= 6),
    },
    {
      label: 'OPEN P0/P1 TICKET',
      weight: 15,
      on: d.tickets.some((t) => t.status === 'open' && (t.priority === 'urgent' || t.priority === 'high')),
    },
    {
      label: 'NEGATIVE MARGIN 30D',
      weight: 25,
      on: d.marginCents30d < 0,
    },
    {
      label: 'PAST DUE INVOICE',
      weight: 20,
      on: d.invoices.some((i) => i.status === 'open' && i.daysDelinquent > 0),
    },
    {
      label: 'DAU TREND DOWN',
      weight: 10,
      on: dauAvg7 < dauAvg28 * 0.6 && dauAvg28 > 0,
    },
    {
      label: 'CHURNED STATUS',
      weight: 30,
      on: a.status === 'churned',
    },
    {
      label: 'PIPELINE STALE',
      weight: 10,
      on: d.pipelinePerEngine.some((p) => freshnessState(p.lastRunAt, now) === 'red'),
    },
  ]
  const riskScore = Math.min(100, factors.filter((f) => f.on).reduce((s, f) => s + f.weight, 0))

  // Build timeline
  const timeline: TimelineEvent[] = []
  for (const e of d.subEvents)
    timeline.push({
      at: e.occurredAt.getTime(),
      kind: 'SUB',
      title: e.type.toUpperCase(),
      detail: e.mrrDeltaUsdCents !== 0 ? `MRR ${formatCents(e.mrrDeltaUsdCents)}` : undefined,
    })
  for (const e of d.adminActions)
    timeline.push({
      at: e.createdAt.getTime(),
      kind: 'ADMIN',
      title: `${e.type.toUpperCase()} · ${e.status.toUpperCase()}`,
      detail: e.requestedBy,
    })
  for (const e of d.invoices)
    timeline.push({
      at: e.createdAt.getTime(),
      kind: 'INVOICE',
      title: `INVOICE · ${e.status.toUpperCase()}`,
      detail: formatCents(e.amountUsdCents),
    })
  for (const t of d.tickets)
    timeline.push({
      at: t.createdAt.getTime(),
      kind: 'TICKET',
      title: `TICKET · ${t.priority.toUpperCase()} · ${t.status.toUpperCase()}`,
      detail: t.ticketId,
    })
  for (const n of d.nps)
    timeline.push({
      at: n.surveyedAt.getTime(),
      kind: 'NPS',
      title: `NPS · ${n.score}/10`,
      detail: n.comment ?? undefined,
    })
  timeline.sort((a, b) => b.at - a.at)

  const cost30Cents = d.spendMicrocents30d / 10_000
  const revenue30Cents = a.mrrUsdCents
  const marginPct =
    revenue30Cents > 0 ? (d.marginCents30d / revenue30Cents) * 100 : 0

  return (
    <>
      <PageHeader
        section={base.section}
        label="Account 360"
        meta={`ID ${a.id}`}
        right={
          <Link
            href="/customers/accounts"
            className="font-mono text-[10px] uppercase tracking-[0.12em] underline-offset-2 hover:underline"
          >
            ← ACCOUNTS
          </Link>
        }
      />

      {/* Identity strip */}
      <section className="border border-black/15 bg-paper p-3 mb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-px bg-black/15">
          <IdCell label="NAME" value={a.name} mono />
          <IdCell label="TYPE" value={a.type.toUpperCase()} />
          <IdCell label="PLAN" value={planLabel(a.planTier)} />
          <IdCell
            label="STATUS"
            value={
              <span className="inline-flex items-center gap-1.5">
                <StatusBox status={a.status} />
                <span>{a.status.toUpperCase()}</span>
              </span>
            }
          />
          <IdCell label="COUNTRY" value={a.country ?? '—'} />
          <IdCell label="WORKSPACES" value={formatNumber(a.workspaceCount)} numeric />
          <IdCell
            label="CREATED"
            value={`${formatRelativeTime(a.createdAt.getTime(), now)} AGO`}
            numeric
          />
          <IdCell
            label="CHURNED"
            value={a.churnedAt ? `${formatRelativeTime(a.churnedAt.getTime(), now)} AGO` : '—'}
            numeric
          />
        </div>
      </section>

      {/* KPI tiles */}
      <KpiGrid cols={8} className="mb-3">
        <KpiCard label="MRR" value={formatCents(a.mrrUsdCents)} />
        <KpiCard
          label="SPEND 30D"
          value={formatMicrocents(d.spendMicrocents30d)}
          meta="LLM COST"
        />
        <KpiCard
          label="MARGIN 30D"
          value={formatCents(d.marginCents30d)}
          meta={
            revenue30Cents > 0 ? formatPercent(marginPct, undefined, 0) : undefined
          }
        />
        <KpiCard
          label="RUNS 30D"
          value={formatNumber(d.promptRuns30d)}
          meta="PROMPT"
        />
        <KpiCard label="USERS" value={formatNumber(d.users.length)} />
        <KpiCard
          label="DAU AVG 7D"
          value={formatNumber(Math.round(dauAvg7))}
          spark={dau7}
        />
        <KpiCard
          label="STICKINESS"
          value={formatPercent(stickiness * 100, undefined, 0)}
          meta="DAU/WAU"
        />
        <KpiCard
          label="RISK"
          value={formatNumber(riskScore)}
          meta={riskScore >= 60 ? 'AT-RISK' : riskScore >= 30 ? 'WATCH' : 'OK'}
        />
      </KpiGrid>

      {/* Subscription & billing + Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Panel title="SUBSCRIPTION & BILLING" meta="STRIPE">
          {sub ? (
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px]">
              <Cell label="SUB ID" value={sub.id} mono />
              <Cell
                label="STATUS"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <StatusBox status={sub.status} />
                    <span className="font-mono uppercase tracking-[0.08em]">
                      {sub.status.toUpperCase()}
                    </span>
                  </span>
                }
              />
              <Cell label="PLAN" value={planLabel(sub.planTier)} />
              <Cell label="INTERVAL" value={sub.interval.toUpperCase()} />
              <Cell label="QUANTITY" value={formatNumber(sub.quantity)} numeric />
              <Cell label="MRR" value={formatCents(sub.mrrUsdCents)} numeric />
              <Cell label="CURRENCY" value={sub.currency} />
              <Cell
                label="TRIAL END"
                value={sub.trialEnd ? `${formatRelativeTime(sub.trialEnd.getTime(), now)}` : '—'}
                numeric
              />
              <Cell
                label="PERIOD END"
                value={
                  sub.currentPeriodEnd
                    ? `${formatRelativeTime(sub.currentPeriodEnd.getTime(), now)}`
                    : '—'
                }
                numeric
              />
              <Cell
                label="CANCELED"
                value={sub.canceledAt ? `${formatRelativeTime(sub.canceledAt.getTime(), now)} AGO` : '—'}
                numeric
              />
              <Cell label="REASON" value={sub.cancelReasonCode?.toUpperCase() ?? '—'} />
              <Cell
                label="STRIPE ID"
                value={a.stripeCustomerId ?? '—'}
                mono
              />
            </div>
          ) : (
            <Empty message="NO SUBSCRIPTION" />
          )}

          {/* Recent invoices */}
          <div className="mt-3 border-t border-black/10 pt-2">
            <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55 mb-1">
              RECENT INVOICES
            </div>
            {d.invoices.length === 0 ? (
              <Empty message="NO INVOICES" />
            ) : (
              <table className="w-full text-[10.5px] font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-black/10 text-black/55">
                    <th className="text-left py-1 px-1 uppercase tracking-[0.08em] font-normal">ID</th>
                    <th className="text-left py-1 px-1 uppercase tracking-[0.08em] font-normal">STATUS</th>
                    <th className="text-right py-1 px-1 uppercase tracking-[0.08em] font-normal">AMOUNT</th>
                    <th className="text-right py-1 px-1 uppercase tracking-[0.08em] font-normal">DEL DAYS</th>
                    <th className="text-right py-1 px-1 uppercase tracking-[0.08em] font-normal">AGE</th>
                  </tr>
                </thead>
                <tbody>
                  {d.invoices.slice(0, 8).map((inv) => (
                    <tr key={inv.id} className="border-b border-black/5">
                      <td className="py-1 px-1 truncate max-w-[100px]" title={inv.id}>
                        {inv.id}
                      </td>
                      <td className="py-1 px-1 uppercase">
                        <span className="inline-flex items-center gap-1.5">
                          <StatusBox status={inv.status} />
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-1 px-1 text-right">
                        {formatCents(inv.amountUsdCents)}
                      </td>
                      <td className="py-1 px-1 text-right">{inv.daysDelinquent}</td>
                      <td className="py-1 px-1 text-right text-black/55">
                        {formatRelativeTime(inv.createdAt.getTime(), now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <Panel title="USAGE · DAU 28D" meta="ACCOUNT_METRICS_DAILY">
          {dau28.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-end justify-between">
                <span className="font-mono tabular-nums text-[20px] font-semibold">
                  {formatNumber(dauValues[dauValues.length - 1] ?? 0)}
                </span>
                <span className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45">
                  TODAY
                </span>
              </div>
              <Sparkline values={dau28} width={420} height={48} />
              <div className="grid grid-cols-3 gap-px bg-black/15 border border-black/15">
                <Cell label="AVG 7D" value={formatNumber(Math.round(dauAvg7))} numeric />
                <Cell label="AVG 28D" value={formatNumber(Math.round(dauAvg28))} numeric />
                <Cell
                  label="STICKY"
                  value={formatPercent(stickiness * 100, undefined, 1)}
                  numeric
                />
              </div>
              <div className="border-t border-black/10 pt-2">
                <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55 mb-1">
                  WORKSPACES · {d.workspaces.length}
                </div>
                {d.workspaces.length === 0 ? (
                  <Empty message="NO WORKSPACES" />
                ) : (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {d.workspaces.slice(0, 10).map((w) => (
                      <li
                        key={w.id}
                        className="text-[10.5px] font-mono tabular-nums flex justify-between"
                      >
                        <span className="truncate">{w.clientName}</span>
                        <span className="text-black/55">
                          {formatNumber(w.promptCount)}P
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Per-engine freshness + Cost & margin */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        <Panel title="PIPELINE · PER-ENGINE FRESHNESS" meta="≤26H">
          {d.pipelinePerEngine.length === 0 ? (
            <Empty message="NO RUNS" />
          ) : (
            <div className="grid grid-cols-1 gap-px bg-black/15 border border-black/15">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-2 py-1.5 bg-paper text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/55">
                <span>ENGINE</span>
                <span className="text-right">RUNS</span>
                <span className="text-right">SUCC</span>
                <span className="text-right">LAST</span>
                <span>STATE</span>
              </div>
              {d.pipelinePerEngine.map((p) => {
                const st = freshnessState(p.lastRunAt, now)
                return (
                  <div
                    key={p.engine}
                    className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 px-2 py-1.5 bg-paper items-center text-[11px] font-mono tabular-nums"
                  >
                    <span className="uppercase tracking-[0.04em]">{p.engine}</span>
                    <span className="text-right">{formatNumber(p.total)}</span>
                    <span className="text-right">
                      {formatPercent(p.successPct * 100, undefined, 1)}
                    </span>
                    <span className="text-right text-black/55">
                      {p.lastRunAt ? formatRelativeTime(p.lastRunAt, now) : '—'}
                    </span>
                    <FreshIndicator state={st} />
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel title="COST & MARGIN · 30D" meta="LLM_COST_LEDGER">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-px bg-black/15 border border-black/15">
              <Cell label="REVENUE" value={formatCents(revenue30Cents)} numeric />
              <Cell label="COST" value={formatCents(cost30Cents)} numeric />
              <Cell
                label="MARGIN"
                value={
                  <span className={cn(d.marginCents30d < 0 ? 'underline decoration-2' : '')}>
                    {formatCents(d.marginCents30d)}
                  </span>
                }
                numeric
              />
            </div>

            <div className="grid grid-cols-[80px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">
                MARGIN %
              </span>
              <div className="relative bg-black/5 h-3">
                <div
                  className={cn(
                    'absolute inset-y-0 left-1/2 bg-black',
                    d.marginCents30d < 0 ? 'right-1/2 left-auto' : ''
                  )}
                  style={
                    d.marginCents30d >= 0
                      ? { width: `${Math.min(50, marginPct / 2)}%` }
                      : { width: `${Math.min(50, Math.abs(marginPct) / 2)}%`, right: '50%' }
                  }
                />
                <div className="absolute inset-y-0 border-l border-black/40" style={{ left: '50%' }} />
              </div>
              <span className="font-mono tabular-nums text-[11px]">
                {formatPercent(marginPct, undefined, 1)}
              </span>
            </div>

            <div className="border-t border-black/10 pt-2">
              <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55 mb-1">
                LIMITS
              </div>
              <Bars
                rows={[
                  {
                    label: 'PROMPTS',
                    value: a.trackedPromptsLimit,
                    max: a.trackedPromptsLimit,
                    display: formatNumber(a.trackedPromptsLimit),
                  },
                  {
                    label: 'ENGINES',
                    value: a.enginesLimit,
                    max: 9,
                    display: formatNumber(a.enginesLimit),
                  },
                  {
                    label: 'WORKSPACES',
                    value: a.workspaceCount,
                    max: Math.max(10, a.workspaceCount),
                    display: formatNumber(a.workspaceCount),
                  },
                ]}
                labelWidth={90}
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Tickets + NPS + Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <Panel title={`TICKETS · ${d.tickets.length}`} meta="HELPSCOUT MIRROR">
          {d.tickets.length === 0 ? (
            <Empty message="NO TICKETS" />
          ) : (
            <ul className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
              {d.tickets.map((t) => (
                <li
                  key={t.ticketId}
                  className="flex items-center gap-2 text-[11px] font-mono tabular-nums border-b border-black/5 pb-1.5"
                >
                  <StatusBox status={t.status} />
                  <Badge variant={t.priority === 'urgent' || t.priority === 'high' ? 'solid' : 'outline'}>
                    {t.priority.toUpperCase()}
                  </Badge>
                  <span className="truncate flex-1" title={t.ticketId}>
                    {t.ticketId}
                  </span>
                  <span className="text-black/55 text-[10px]">
                    {formatRelativeTime(t.createdAt.getTime(), now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`NPS · ${d.nps.length}`} meta="POSTHOG SURVEY">
          {d.nps.length === 0 ? (
            <Empty message="NO RESPONSES" />
          ) : (
            <ul className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
              {d.nps.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-[11px] leading-snug border-b border-black/5 pb-1.5">
                  <Badge variant={n.score >= 9 ? 'solid' : n.score >= 7 ? 'outline' : 'ghost'}>
                    {String(n.score).padStart(2, '0')}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9.5px] font-mono uppercase tracking-[0.10em] text-black/45">
                      {formatRelativeTime(n.surveyedAt.getTime(), now)} AGO
                    </div>
                    {n.comment ? (
                      <div className="text-black/80 truncate" title={n.comment}>
                        {n.comment}
                      </div>
                    ) : (
                      <div className="text-black/35">—</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="RISK · CHURN HEURISTIC" meta={`SCORE ${riskScore}`}>
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-black/60">
                SCORE
              </span>
              <div className="relative bg-black/5 h-3">
                <div
                  className="absolute inset-y-0 left-0 bg-black"
                  style={{ width: `${Math.min(100, riskScore)}%` }}
                />
                <div className="absolute inset-y-0 border-l border-black/40" style={{ left: '60%' }} />
              </div>
              <span className="font-mono tabular-nums text-[14px] font-semibold">
                {riskScore}
              </span>
            </div>
            <div className="border-t border-black/10 mt-1 pt-2">
              <div className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/55 mb-1">
                FACTORS
              </div>
              <ul className="flex flex-col gap-1">
                {factors.map((f, i) => (
                  <li
                    key={i}
                    className={cn(
                      'flex items-center justify-between text-[10.5px] font-mono tabular-nums uppercase tracking-[0.08em]',
                      !f.on ? 'text-black/35' : ''
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          'inline-block w-2 h-2 border border-black',
                          f.on ? 'bg-black' : 'bg-paper'
                        )}
                      />
                      {f.label}
                    </span>
                    <span>+{f.weight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      </div>

      {/* Users + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
        <Panel title={`USERS · ${d.users.length}`} meta="MASKED">
          {d.users.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto">
              {d.users.slice(0, 30).map((u) => (
                <li
                  key={u.id}
                  className="grid grid-cols-[1fr_auto] gap-2 text-[10.5px] font-mono tabular-nums border-b border-black/5 py-1"
                >
                  <span className="truncate">
                    <span className="uppercase tracking-[0.04em]">{maskEmail(u.email)}</span>
                  </span>
                  <span className="text-black/55 uppercase tracking-[0.08em]">
                    {u.roleInAccount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="TIMELINE"
          meta={`${timeline.length} EVENTS`}
          className="lg:col-span-2"
        >
          {timeline.length === 0 ? (
            <Empty />
          ) : (
            <ul className="flex flex-col gap-0 max-h-[360px] overflow-y-auto">
              {timeline.slice(0, 60).map((e, i) => (
                <li
                  key={`${e.kind}-${e.at}-${i}`}
                  className="grid grid-cols-[80px_60px_1fr_auto] gap-3 items-center text-[11px] font-mono tabular-nums border-b border-black/5 py-1.5"
                >
                  <span className="text-black/45 text-[10px] uppercase tracking-[0.08em]">
                    {formatRelativeTime(e.at, now)} AGO
                  </span>
                  <Badge variant="outline">{e.kind}</Badge>
                  <span className="truncate uppercase tracking-[0.04em]">{e.title}</span>
                  <span className="text-black/55 text-[10px] truncate max-w-[180px]">
                    {e.detail ?? ''}
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

// --- helpers ---------------------------------------------------------------

function IdCell({
  label,
  value,
  mono,
  numeric,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  numeric?: boolean
}) {
  return (
    <div className="bg-paper px-3 py-2 flex flex-col gap-0.5 min-w-0">
      <span className="text-[9.5px] font-mono uppercase tracking-[0.12em] text-black/45">
        {label}
      </span>
      <span
        className={cn(
          'text-[12px] font-semibold leading-tight truncate',
          mono || numeric ? 'font-mono tabular-nums' : '',
          numeric ? 'text-right' : ''
        )}
      >
        {value}
      </span>
    </div>
  )
}

function Cell({
  label,
  value,
  mono,
  numeric,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  numeric?: boolean
}) {
  return (
    <div className="bg-paper px-2 py-1.5 flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] font-mono uppercase tracking-[0.12em] text-black/45">
        {label}
      </span>
      <span
        className={cn(
          'text-[11px] leading-tight truncate',
          mono || numeric ? 'font-mono tabular-nums' : ''
        )}
      >
        {value}
      </span>
    </div>
  )
}
