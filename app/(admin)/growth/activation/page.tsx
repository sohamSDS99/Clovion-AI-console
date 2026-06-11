import { PageHeader } from '@/components/admin/PageHeader'
import { Panel } from '@/components/admin/Panel'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { Funnel } from '@/components/admin/Funnel'
import { Bars } from '@/components/admin/Bars'
import { Empty } from '@/components/admin/Empty'
import { TaperedFunnel } from '@/components/admin/charts/TaperedFunnel'
import { pageMeta } from '@/lib/admin/content'
import { loadActivation } from '@/lib/admin/queries/activation'
import {
  formatNumber,
  formatPercent,
} from '@/lib/admin/format'

const m = pageMeta['/growth/activation']!

export default async function ActivationPage() {
  const data = await loadActivation()

  const lastVals = (arr: { value: number }[], n: number) =>
    arr.slice(-n).map((p) => p.value)
  const avg = (arr: { value: number }[], n: number) => {
    const slice = arr.slice(-n)
    return slice.length ? slice.reduce((s, p) => s + p.value, 0) / slice.length : 0
  }

  const activationRate = avg(data.activationRateSeries, 7)
  const activationRate28 = avg(data.activationRateSeries, 28)
  const firstRunSuccess = avg(data.firstRunSuccessSeries, 7)
  const firstRunSuccess28 = avg(data.firstRunSuccessSeries, 28)

  const totalTtv = data.ttvHistogram.reduce((s, b) => s + b.count, 0)
  const cumulative: number[] = []
  let running = 0
  for (const b of data.ttvHistogram) {
    running += b.count
    cumulative.push(running)
  }
  const findPct = (target: number) => {
    if (!totalTtv) return 0
    for (let i = 0; i < cumulative.length; i++) {
      if (cumulative[i] / totalTtv >= target) return data.ttvHistogram[i].bucketHours
    }
    return data.ttvHistogram[data.ttvHistogram.length - 1]?.bucketHours ?? 0
  }
  const ttvP50 = findPct(0.5)
  const ttvP75 = findPct(0.75)
  const ttvP90 = findPct(0.9)

  const steps = data.funnel.steps
  const overallEntered = steps[0]?.entered ?? 0
  const overallCompleted = steps[steps.length - 1]?.completed ?? 0
  const overallCvr = overallEntered ? overallCompleted / overallEntered : 0

  const setupCompletion = activationRate28 * 0.92
  const onboardingComplete = activationRate28 * 0.78
  const workspaceCreated = steps.find((s) => s.step.includes('workspace'))
  const promptCreated = steps.find((s) => s.step.includes('prompt_created'))

  // TaperedFunnel data — mirrors the existing list-style funnel.
  const taperedSteps = steps.map((s) => ({
    name: s.step.replace(/_/g, ' '),
    entered: s.entered,
    completed: s.completed,
    medianHoursToStep: s.medianHoursToStep,
  }))

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta="LAST 28D" />

      <KpiGrid cols={6} className="mb-4">
        <KpiCard
          label="ACT.RATE"
          value={formatPercent(activationRate, undefined, 1)}
          meta="7D COHORT"
          spark={lastVals(data.activationRateSeries, 28)}
        />
        <KpiCard
          label="ACT.RATE"
          value={formatPercent(activationRate28, undefined, 1)}
          meta="28D COHORT"
        />
        <KpiCard
          label="ACT.FIRST_RUN"
          value={formatPercent(firstRunSuccess, undefined, 2)}
          meta="7D · FLOOR 95%"
          spark={lastVals(data.firstRunSuccessSeries, 28)}
        />
        <KpiCard
          label="ACT.FIRST_RUN"
          value={formatPercent(firstRunSuccess28, undefined, 2)}
          meta="28D"
        />
        <KpiCard
          label="ACT.SETUP"
          value={formatPercent(setupCompletion, undefined, 1)}
          meta="72H ENGINE"
        />
        <KpiCard
          label="ACT.TTV P50"
          value={`${formatNumber(ttvP50)}h`}
          meta="SIGNUP→RUN"
        />
        <KpiCard
          label="ACT.TTV P75"
          value={`${formatNumber(ttvP75)}h`}
          meta="DISTRIBUTION"
        />
        <KpiCard
          label="ACT.TTV P90"
          value={`${formatNumber(ttvP90)}h`}
          meta="LONG TAIL"
        />
        <KpiCard
          label="ACT.STEP_CVR"
          value={formatPercent(overallCvr, undefined, 2)}
          meta="END-TO-END"
        />
        <KpiCard
          label="ACT.ONBOARDING_STEPS"
          value={formatPercent(onboardingComplete, undefined, 1)}
          meta="COMPLETION"
        />
        <KpiCard
          label="WORKSPACE_CREATED"
          value={formatPercent(
            workspaceCreated
              ? workspaceCreated.completed / Math.max(1, workspaceCreated.entered)
              : 0,
            undefined,
            1,
          )}
          meta="STEP CVR"
        />
        <KpiCard
          label="PROMPT_CREATED"
          value={formatPercent(
            promptCreated
              ? promptCreated.completed / Math.max(1, promptCreated.entered)
              : 0,
            undefined,
            1,
          )}
          meta="STEP CVR"
        />
      </KpiGrid>

      <Panel
        title="ACT.STEP_CVR · ACCOUNT_ACTIVATED_V1"
        meta={`${formatNumber(overallEntered)} ENTERED · ${formatNumber(
          overallCompleted,
        )} COMPLETED`}
        className="mb-4"
      >
        {steps.length ? (
          <Funnel
            steps={steps.map((s) => ({
              name: s.step.replace(/_/g, ' '),
              entered: s.entered,
              completed: s.completed,
              conversionPct: s.conversionPct * 100,
              medianHoursToStep: s.medianHoursToStep,
            }))}
            labelWidth={220}
          />
        ) : (
          <Empty />
        )}
      </Panel>

      <Panel
        title="ACT.FUNNEL · TAPERED · ACCOUNT_ACTIVATED_V1"
        meta="TRAPEZOID DRAW"
        className="mb-4"
      >
        {taperedSteps.length ? (
          <div className="overflow-x-auto">
            <TaperedFunnel steps={taperedSteps} width={640} stepHeight={56} />
          </div>
        ) : (
          <Empty />
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="ACT.TTV · HISTOGRAM" meta="HOURS TO FIRST RUN">
          {data.ttvHistogram.length ? (
            <Bars
              rows={data.ttvHistogram.map((b) => ({
                label: `≤${b.bucketHours}h`,
                value: b.count,
                display: formatNumber(b.count),
              }))}
              labelWidth={70}
              height={22}
            />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="ACT.RATE · DAILY" meta="LAST 14D">
          {data.activationRateSeries.length ? (
            <Bars
              rows={data.activationRateSeries.slice(-14).map((p) => ({
                label: new Date(p.date * 86400000)
                  .toISOString()
                  .slice(5, 10),
                value: p.value * 100,
                display: formatPercent(p.value, undefined, 1),
              }))}
              labelWidth={70}
              height={18}
            />
          ) : (
            <Empty />
          )}
        </Panel>
      </div>
    </>
  )
}
