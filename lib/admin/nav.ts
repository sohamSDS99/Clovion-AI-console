// Sidebar navigation registry — 6 top-level categories.
// Sub-modules render as tabs inside each category dashboard.

export type NavItem = {
  n: number
  code: string
  label: string
  href: string
}

export const sidebar: NavItem[] = [
  { n: 1, code: 'CMD', label: 'Command', href: '/' },
  { n: 2, code: 'GRW', label: 'Growth', href: '/growth' },
  { n: 3, code: 'PLT', label: 'Platform', href: '/platform' },
  { n: 4, code: 'CST', label: 'Customers', href: '/customers' },
  { n: 5, code: 'OPS', label: 'Operate', href: '/operate' },
  { n: 6, code: 'GOV', label: 'Govern', href: '/govern' },
  { n: 7, code: 'CHN', label: 'Channels', href: '/channels' },
  { n: 8, code: 'BEH', label: 'Behavior', href: '/behavior' },
]

export type CategoryTab = { code: string; label: string; href: string }

export const categoryTabs: Record<string, CategoryTab[]> = {
  growth: [
    { code: 'ACQ', label: 'Acquisition', href: '/growth/acquisition' },
    { code: 'ACT', label: 'Activation', href: '/growth/activation' },
    { code: 'ENG', label: 'Engagement', href: '/growth/engagement' },
    { code: 'RET', label: 'Retention', href: '/growth/retention' },
    { code: 'REV', label: 'Revenue', href: '/growth/revenue' },
    { code: 'FNL', label: 'Funnels', href: '/growth/funnels' },
    { code: 'JNY', label: 'User Journey', href: '/growth/journey' },
  ],
  platform: [
    { code: 'PRF', label: 'Performance', href: '/platform/performance' },
    { code: 'PIP', label: 'Pipeline', href: '/platform/pipeline' },
    { code: 'SUP', label: 'Support', href: '/platform/support' },
  ],
  customers: [
    { code: 'ACT', label: 'Accounts', href: '/customers/accounts' },
  ],
  operate: [
    { code: 'OPS', label: 'Operations', href: '/operate/operations' },
    { code: 'FLG', label: 'Flags', href: '/operate/flags' },
    { code: 'ALR', label: 'Alerts', href: '/operate/alerts' },
  ],
  govern: [
    { code: 'AUD', label: 'Audit', href: '/govern/audit' },
    { code: 'GDP', label: 'GDPR', href: '/govern/gdpr' },
    { code: 'SET', label: 'Settings', href: '/govern/settings' },
  ],
}
