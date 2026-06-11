/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ['better-sqlite3'] },
  async redirects() {
    return [
      // Common singular/plural typos — silently route to the canonical page.
      { source: '/growth/funnel', destination: '/growth/funnels', permanent: false },
      { source: '/growth/account', destination: '/customers/accounts', permanent: false },
      { source: '/customers/account', destination: '/customers/accounts', permanent: false },
      { source: '/operate/operation', destination: '/operate/operations', permanent: false },
      { source: '/operate/flag', destination: '/operate/flags', permanent: false },
      { source: '/operate/alert', destination: '/operate/alerts', permanent: false },
      { source: '/govern/setting', destination: '/govern/settings', permanent: false },
      // Legacy flat routes from before the category restructure — keep external links working.
      { source: '/acquisition', destination: '/growth/acquisition', permanent: false },
      { source: '/activation', destination: '/growth/activation', permanent: false },
      { source: '/engagement', destination: '/growth/engagement', permanent: false },
      { source: '/retention', destination: '/growth/retention', permanent: false },
      { source: '/revenue', destination: '/growth/revenue', permanent: false },
      { source: '/funnels', destination: '/growth/funnels', permanent: false },
      { source: '/journey', destination: '/growth/journey', permanent: false },
      { source: '/performance', destination: '/platform/performance', permanent: false },
      { source: '/pipeline', destination: '/platform/pipeline', permanent: false },
      { source: '/support', destination: '/platform/support', permanent: false },
      { source: '/accounts', destination: '/customers/accounts', permanent: false },
      { source: '/operations', destination: '/operate/operations', permanent: false },
      { source: '/flags', destination: '/operate/flags', permanent: false },
      { source: '/alerts', destination: '/operate/alerts', permanent: false },
      { source: '/audit', destination: '/govern/audit', permanent: false },
      { source: '/gdpr', destination: '/govern/gdpr', permanent: false },
      { source: '/settings', destination: '/govern/settings', permanent: false },
    ]
  },
}

module.exports = nextConfig
