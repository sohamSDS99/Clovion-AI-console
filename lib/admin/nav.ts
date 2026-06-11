// Sidebar navigation registry — 17 modules grouped per PRD §2.2.
// Three-letter codes keep rows compact for terminal-density rendering.

export type NavItem = {
  n: number
  code: string
  label: string
  href: string
}

export type NavGroup = {
  group: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    group: 'OVERVIEW',
    items: [{ n: 1, code: 'CMD', label: 'Command', href: '/' }],
  },
  {
    group: 'GROWTH',
    items: [
      { n: 2, code: 'ACQ', label: 'Acquisition', href: '/acquisition' },
      { n: 3, code: 'ACT', label: 'Activation', href: '/activation' },
      { n: 4, code: 'ENG', label: 'Engagement', href: '/engagement' },
      { n: 5, code: 'RET', label: 'Retention', href: '/retention' },
      { n: 6, code: 'REV', label: 'Revenue', href: '/revenue' },
      { n: 7, code: 'FNL', label: 'Funnels', href: '/funnels' },
      { n: 8, code: 'JNY', label: 'User Journey', href: '/journey' },
    ],
  },
  {
    group: 'PLATFORM',
    items: [
      { n: 9, code: 'PRF', label: 'Performance', href: '/performance' },
      { n: 10, code: 'PIP', label: 'Pipeline', href: '/pipeline' },
      { n: 11, code: 'SUP', label: 'Support', href: '/support' },
    ],
  },
  {
    group: 'CUSTOMERS',
    items: [{ n: 12, code: 'ACT', label: 'Accounts', href: '/accounts' }],
  },
  {
    group: 'OPERATE',
    items: [
      { n: 13, code: 'OPS', label: 'Operations', href: '/operations' },
      { n: 14, code: 'FLG', label: 'Flags', href: '/flags' },
      { n: 15, code: 'ALR', label: 'Alerts', href: '/alerts' },
    ],
  },
  {
    group: 'GOVERN',
    items: [
      { n: 16, code: 'AUD', label: 'Audit', href: '/audit' },
      { n: 17, code: 'GDP', label: 'GDPR', href: '/gdpr' },
      { n: 18, code: 'SET', label: 'Settings', href: '/settings' },
    ],
  },
]

/** Flat lookup of href -> nav item (used by PageHeader auto-resolution). */
export const NAV_BY_HREF: Record<string, { group: string; item: NavItem }> =
  NAV.flatMap((g) => g.items.map((item) => ({ group: g.group, item }))).reduce(
    (acc, cur) => {
      acc[cur.item.href] = cur
      return acc
    },
    {} as Record<string, { group: string; item: NavItem }>,
  )
