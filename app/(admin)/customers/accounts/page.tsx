import { PageHeader } from '@/components/admin/PageHeader'
import { KpiCard, KpiGrid } from '@/components/admin/KpiCard'
import { pageMeta } from '@/lib/admin/content'
import { loadAccountList } from '@/lib/admin/queries/accounts'
import { formatCents, formatNumber, formatPercent } from '@/lib/admin/format'
import { AccountsTable } from './_AccountsTable'

const m = pageMeta['/customers/accounts']!

export default async function AccountsPage() {
  const rows = await loadAccountList()

  const total = rows.length
  const active = rows.filter((r) => r.status === 'active').length
  const trialing = rows.filter((r) => r.status === 'trialing').length
  const churned = rows.filter((r) => r.status === 'churned').length
  const enterprise = rows.filter((r) => r.planTier === 'enterprise').length
  const totalMrr = rows.reduce((s, r) => s + r.mrrUsdCents, 0)
  const negativeMargin = rows.filter((r) => r.marginUsdCents < 0).length
  const atRisk = rows.filter((r) => r.churnRiskScore >= 60 && r.status !== 'churned').length

  return (
    <>
      <PageHeader section={m.section} label={m.label} meta={`${formatNumber(total)} ACCOUNTS`} />

      <KpiGrid cols={8} className="mb-3">
        <KpiCard label="TOTAL" value={formatNumber(total)} />
        <KpiCard
          label="ACTIVE"
          value={formatNumber(active)}
          meta={formatPercent((active / (total || 1)) * 100, undefined, 0)}
        />
        <KpiCard
          label="TRIALING"
          value={formatNumber(trialing)}
          meta={formatPercent((trialing / (total || 1)) * 100, undefined, 0)}
        />
        <KpiCard
          label="CHURNED"
          value={formatNumber(churned)}
          meta={formatPercent((churned / (total || 1)) * 100, undefined, 0)}
        />
        <KpiCard label="ENTERPRISE" value={formatNumber(enterprise)} />
        <KpiCard label="MRR TOTAL" value={formatCents(totalMrr)} />
        <KpiCard
          label="MARGIN NEG"
          value={formatNumber(negativeMargin)}
          meta="UNIT-LOSS"
        />
        <KpiCard
          label="AT-RISK"
          value={formatNumber(atRisk)}
          meta="RISK ≥60"
        />
      </KpiGrid>

      <AccountsTable rows={rows} />
    </>
  )
}
