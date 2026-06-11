// Static page metadata for the 17 modules. Used by PageHeader callers.
// Page titles are NOUN PHRASES ONLY (PRD-compliant, no verbs, no sentences).

export type PageMeta = {
  section: string
  label: string
  meta?: string
}

export const pageMeta: Record<string, PageMeta> = {
  '/': { section: 'OVERVIEW', label: 'Command Center' },
  '/acquisition': { section: 'GROWTH', label: 'Acquisition' },
  '/activation': { section: 'GROWTH', label: 'Activation' },
  '/engagement': { section: 'GROWTH', label: 'Engagement' },
  '/retention': { section: 'GROWTH', label: 'Retention' },
  '/revenue': { section: 'GROWTH', label: 'Revenue' },
  '/funnels': { section: 'GROWTH', label: 'Funnels' },
  '/journey': { section: 'GROWTH', label: 'User Journey' },
  '/performance': { section: 'PLATFORM', label: 'Performance' },
  '/pipeline': { section: 'PLATFORM', label: 'Pipeline Ops' },
  '/support': { section: 'PLATFORM', label: 'Support & NPS' },
  '/accounts': { section: 'CUSTOMERS', label: 'Accounts' },
  '/operations': { section: 'OPERATE', label: 'Admin Operations' },
  '/flags': { section: 'OPERATE', label: 'Feature Flags' },
  '/alerts': { section: 'OPERATE', label: 'Alerts' },
  '/audit': { section: 'GOVERN', label: 'Audit Log' },
  '/gdpr': { section: 'GOVERN', label: 'GDPR Requests' },
  '/settings': { section: 'GOVERN', label: 'Settings' },
}

export function metaFor(pathname: string): PageMeta {
  return pageMeta[pathname] ?? { section: 'OVERVIEW', label: 'Console' }
}
