// Static page metadata for the 17 modules. Used by PageHeader callers.
// Page titles are NOUN PHRASES ONLY (PRD-compliant, no verbs, no sentences).

export type PageMeta = {
  section: string
  label: string
  meta?: string
}

export const pageMeta: Record<string, PageMeta> = {
  '/': { section: 'OVERVIEW', label: 'Command Center' },
  '/growth/acquisition': { section: 'GROWTH', label: 'Acquisition' },
  '/growth/activation': { section: 'GROWTH', label: 'Activation' },
  '/growth/engagement': { section: 'GROWTH', label: 'Engagement' },
  '/growth/retention': { section: 'GROWTH', label: 'Retention' },
  '/growth/revenue': { section: 'GROWTH', label: 'Revenue' },
  '/growth/funnels': { section: 'GROWTH', label: 'Funnels' },
  '/growth/journey': { section: 'GROWTH', label: 'User Journey' },
  '/platform/performance': { section: 'PLATFORM', label: 'Performance' },
  '/platform/pipeline': { section: 'PLATFORM', label: 'Pipeline Ops' },
  '/platform/support': { section: 'PLATFORM', label: 'Support & NPS' },
  '/customers/accounts': { section: 'CUSTOMERS', label: 'Accounts' },
  '/operate/operations': { section: 'OPERATE', label: 'Admin Operations' },
  '/operate/flags': { section: 'OPERATE', label: 'Feature Flags' },
  '/operate/alerts': { section: 'OPERATE', label: 'Alerts' },
  '/govern/audit': { section: 'GOVERN', label: 'Audit Log' },
  '/govern/gdpr': { section: 'GOVERN', label: 'GDPR Requests' },
  '/govern/settings': { section: 'GOVERN', label: 'Settings' },
}

export function metaFor(pathname: string): PageMeta {
  return pageMeta[pathname] ?? { section: 'OVERVIEW', label: 'Console' }
}
