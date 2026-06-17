# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## What this is

**Clovion Console** — internal admin & monitoring panel for Clovion AI (an AI-visibility / GEO analytics SaaS).
Staff-only. No customer-facing surfaces. Built per the canonical PRD at `/tmp/clovion_prd.txt` (extracted from `CLOVION_ADMIN_PANEL_PRD.pdf`); the PRD is the bible — every metric, route, and acceptance criterion traces back to it.

**Repo:** [`github.com/sohamSDS99/Clovion-AI-console`](https://github.com/sohamSDS99/Clovion-AI-console) — `origin/main`.

## Hard rules (read before doing anything)

1. **Only work inside this folder** (`/Users/sohamsarker/Clovion AI Console`). The sibling folder `/Users/sohamsarker/Clovion AI/` is a **separate marketing-site project** — never read or modify it. We had a painful misdirection early in the project history.
2. **Pure brutalist B&W chrome.** Sidebar, topbar, KpiCards, Panels, DataTables, badges, page headers, FreshnessStrip — `#000` and `#fff` and grayscale opacity only. Status indicators encode state via filled/half-filled/hollow boxes, never red/green/amber.
3. **Charts CAN use color** via the palette tokens `--chart-1..8` in `app/globals.css` (sourced from `lib/admin/palette.ts`). Color stays inside chart fills/strokes — chrome stays pure B&W. Text labels inside charts stay black for legibility.
4. **No rounded corners** anywhere. `* { border-radius: 0 !important; }` is enforced globally in `app/globals.css`. Tailwind `rounded-*` classes also forbidden — they pollute the source even if the CSS reset wins.
5. **No transitions, no animations, no `framer-motion`, no `shadow-*`.** Static surfaces only.
6. **No marketing copy.** No "Welcome", "Pro tip", "Get started", helper text, emoji. Labels are uppercase tracking-wide; page titles are noun phrases; actions are uppercase verbs.
7. **Single typeface: Saans SemiBold** (loaded via `next/font/local` from `app/fonts/Saans-TRIAL-SemiBold.otf`). The `font-mono` Tailwind class is mapped to Saans too — tabular numerics come from `font-variant-numeric: tabular-nums` + OpenType `tnum` feature, not from a monospace font. (We tried JetBrains Mono; without loading it, it fell back to macOS Menlo and dominated every label. That bug is closed — don't reopen it.)

## Stack

- **Next.js 14** App Router + TypeScript + Tailwind CSS
- **Drizzle ORM** + **better-sqlite3** (SQLite at `data/console.db`)
- **Auth.js (NextAuth v5 beta)** with Credentials provider for the demo; production PRD §4.2 spec is Google Workspace SSO + staff allowlist
- **All charts** are SVG, server-rendered by default. Hover interactivity (added later) requires `'use client'` — see "Charts" below.

## Routing — IA (PRD §2.2 with one local addition)

Sidebar is FLAT (8 top-level items, no group headers). Sub-modules become **tabs at the top of each category page**.

| Sidebar item | Route | Tabs (sub-modules) |
|---|---|---|
| Command | `/` | (no tabs — single page) |
| Growth | `/growth` | Acquisition · Activation · Engagement · Retention · Revenue · Funnels · User Journey |
| Platform | `/platform` | Performance · Pipeline · Support |
| Customers | `/customers` | Accounts (`/customers/accounts`, `/customers/accounts/[id]` Account 360) |
| Operate | `/operate` | Operations · Flags · Alerts |
| Govern | `/govern` | Audit · GDPR · Settings |
| Channels | `/channels` | (standalone — every PRD metric pivoted by acquisition channel) |
| Behavior | `/behavior` | (standalone — user-behavior tracking, feature lifecycle, per-feature funnels) |

`Channels` and `Behavior` are non-PRD additions agreed with the user. Everything else maps 1:1 to PRD §2.2.

`/growth`, `/platform`, etc. **redirect to their first tab**. `next.config.js` also registers ~22 redirect rules covering common singular/plural typos (`/growth/funnel` → `/growth/funnels`) and the pre-restructure flat routes (`/revenue` → `/growth/revenue`).

## Directory layout

```
app/
├── (admin)/                # auth-gated route group — sidebar + topbar layout
│   ├── layout.tsx          # Sidebar + Topbar shell, requires session
│   ├── page.tsx            # Command Center (the root of the admin)
│   ├── growth/             # 7 tabs incl. user journey
│   ├── platform/           # 3 tabs
│   ├── customers/          # accounts directory + [id] Account 360
│   ├── operate/            # 3 tabs
│   ├── govern/             # 3 tabs
│   ├── channels/page.tsx   # standalone channel-pivot dashboard
│   └── behavior/page.tsx   # standalone behavior / feature lifecycle dashboard
├── login/                  # public credentials sign-in
├── api/auth/[...nextauth]  # NextAuth route handler
├── fonts/Saans-TRIAL-SemiBold.otf
├── globals.css             # B&W tokens + --chart-1..8 palette + brutalist resets
└── layout.tsx              # root layout (loads Saans font)

components/admin/
├── Sidebar.tsx · Topbar.tsx · TabStrip.tsx · PageHeader.tsx
├── KpiCard.tsx · Panel.tsx · DataTable.tsx · Badge.tsx · Empty.tsx
├── FreshnessStrip.tsx
├── Sparkline.tsx Bars.tsx Funnel.tsx Heatmap.tsx Waterfall.tsx
│   (older primitives — these all delegate to or re-export from ./charts/)
└── charts/                 # all newer chart primitives, ALL 'use client' with hover tooltips
    ├── ChartTooltip.tsx + useTooltip.ts + useChartCursor.ts   # shared hover stack
    ├── AreaChart MultiLine Sparkline                          # trace-based
    ├── Donut Sankey TaperedFunnel Waterfall Gauge RadialBars  # shape-based
    ├── Heatmap Calendar Matrix Bars Funnel StackedBars        # grid-based
    ├── Legend.tsx                                             # shared swatch row
    └── PageWrappers.tsx                                       # closes over format/colors props
                                                                #   on client to avoid passing arrow
                                                                #   functions across the RSC boundary
                                                                #   (WaterfallCents, HeatmapPercent,
                                                                #    HeatmapInteger, etc.)

lib/
├── cn.ts                          # twMerge + clsx helper
├── admin/
│   ├── palette.ts                 # CHART_PALETTE, paletteAt(i), paletteForKey(key)
│   ├── content.ts                 # pageMeta keyed by route
│   ├── nav.ts                     # sidebar (flat 8-item) + categoryTabs (per-category tab defs)
│   ├── session.ts                 # requireSession() server helper
│   ├── permissions.ts             # RBAC matrix per PRD §4.7
│   ├── format.ts                  # formatCents / formatMicrocents / formatPercent / etc.
│   ├── metrics/                   # semantic layer — one file per PRD §A subsection
│   │   ├── index.ts               # METRICS array + metricByKey() lookup
│   │   └── acquisition.ts activation.ts engagement.ts retention.ts revenue.ts
│   │       performance.ts pipeline.ts support.ts governance.ts freshness.ts
│   │       benchmarks.ts          # versioned external benchmarks (PRD §A.0)
│   └── queries/                   # one query module per page — loads + aggregates from SQLite
│       ├── command-center.ts acquisition.ts activation.ts engagement.ts retention.ts
│       ├── revenue.ts funnels.ts journey.ts behavior.ts channels.ts
│       ├── performance.ts pipeline.ts support.ts cost.ts
│       ├── accounts.ts operations.ts flags.ts alerts.ts audit.ts gdpr.ts settings.ts
└── db/
    ├── index.ts          # Drizzle + better-sqlite3 client
    ├── schema.ts         # ~30+ tables per PRD §4.3 (see schema overview below)
    ├── types.ts          # union types (Role, PlanTier, EngineKey, FailureClass, …)
    └── migrations/       # drizzle-kit generated SQL

scripts/
├── migrate.ts            # applies all migrations to data/console.db
└── seed.ts               # deterministic mulberry32(0x1337) seed — 60 days of realistic data

auth.config.ts auth.ts middleware.ts   # NextAuth v5 — middleware imports auth.config (edge-safe)
```

## DB schema (lib/db/schema.ts)

PRD §4.3 data model. Money in `*_usd_cents` (integer). LLM cost in `*_usd_microcents` (integer). Timestamps `integer({ mode: 'timestamp_ms' })`.

Tables (grouped):
- **staff + auth**: `staff_users`
- **mirrored dims**: `accounts`, `users`, `workspaces`, `subscriptions`
- **events + facts**: `usage_events`, `identity_map`, `pipeline_runs`, `llm_cost_ledger`, `subscription_events`, `stripe_invoices`, `support_tickets_mirror`, `nps_responses`
- **rollups**: `metric_rollup_daily`, `account_metrics_daily`, `funnel_definitions`, `funnel_results_daily`, `cohort_retention_monthly`
- **configuration**: `channel_spend`, `model_prices`, `fx_rates`, `ops_settings`, `feature_flag_mirror`, `staff_users`
- **operational**: `alerts`, `admin_actions`, `gdpr_requests`, `audit_log` (hash-chained), `sync_watermarks`, `ingest_dead_letter`, `reconciliation_issues`, `scraper_health_states`

When extending: keep types in `lib/db/types.ts` so query files can import them without touching schema.

## Commands

```bash
npm install
npm run dev          # next dev — quick iteration, HMR
npm run dev:clean    # rm -rf .next && next dev — use after editing fonts / globals.css / tailwind.config
npm run build        # next build
npm start            # production server (after build)
npm run typecheck    # tsc --noEmit
npm run db:migrate   # apply migrations to data/console.db
npm run db:seed      # populate deterministic demo data
npm run db:reset     # rm db + migrate + seed (idempotent rebuild)
```

**Demo credentials** (seeded by `scripts/seed.ts`, all password `admin`):
- `owner@clovion.ai` — full RBAC (PII reveal, refunds, kill-switches, manage staff)
- `admin@clovion.ai`, `analyst@clovion.ai`, `support@clovion.ai`, `engineer@clovion.ai` — restricted per PRD §4.7

## Conventions

### Adding a new metric

1. Define it in the appropriate `lib/admin/metrics/<section>.ts` (acquisition/activation/etc.) with `{ key, version, owner, unit, grain, description, benchmark? }`.
2. Compute it in the relevant `lib/admin/queries/<page>.ts`.
3. Render it on the page via `<KpiCard label="ACQ.SIGNUPS" value={…} spark={…} delta={…} meta={…} />`.
4. The Settings dictionary page (`/govern/settings`) auto-renders the semantic layer — no UI change needed.

### Adding a chart

- New primitives go in `components/admin/charts/`.
- If hoverable (almost always yes), it's a `'use client'` component using `useTooltip()` + `<ChartTooltip />`.
- Series colors come from `paletteAt(i)` or `paletteForKey(key)` from `lib/admin/palette.ts`. Never hardcode hex.
- Server pages can't pass inline arrow `format` or `colors` to client charts — wrap them in `PageWrappers.tsx` (see `WaterfallCents` / `HeatmapPercent` for the pattern).

### Color rules

- **Chrome** (sidebar, topbar, KpiCard borders, table rows, page headers, badges, freshness strip): black + white + opacity only. Zero non-monochrome hex codes.
- **Charts**: `var(--chart-1..8)` only. Each data point on a categorical chart cycles the palette; small-multiples no longer keep per-card colors (that decision was reversed — data-point differentiation wins).
- **Single-color preserved** for: continuous time-series in single-series AreaCharts and all Sparklines (multicolor would mislead on a continuous series). Sparklines DO vary color across KpiCards via `paletteForKey(label)`.

### Brutalist enforcement

Before merging, grep across `app/` and `components/`:
```
grep -rE "rounded-|transition-[a-z]+|shadow-|framer-motion" app components --include="*.tsx" --include="*.ts"
```
Must return zero hits. Same for non-monochrome hex codes in any chrome file (`Sidebar.tsx`, `Topbar.tsx`, `KpiCard.tsx`, `Panel.tsx`, `DataTable.tsx`, `PageHeader.tsx`, `Badge.tsx`, `FreshnessStrip.tsx`).

## Known gotchas

- **Next.js dev cache** sometimes serves a stale HTML shell that references chunk hashes which no longer exist on disk, especially after editing `next/font/local`, `tailwind.config.ts`, or `app/globals.css` `:root`. Fix: `npm run dev:clean`.
- **macOS does NOT have `setsid`.** To detach long-running background processes (e.g. `npm start`, `ngrok`) from the harness session, use `nohup <cmd> > <log> 2>&1 & disown`.
- **NextAuth + tunnel hosts** (ngrok etc.): `AUTH_TRUST_HOST=true` is set in `.env.local`. If you also set `NEXTAUTH_URL` to a specific host, callbacks pin to that host — convenient when sharing a fixed ngrok URL, awkward when you also want localhost. With production mode (`npm start`), `X-Forwarded-Host` headers are honored automatically and you can usually omit `NEXTAUTH_URL`.
- **Server → Client prop serialization**: don't pass inline arrow functions (`format={(v) => …}`, `onClick={() => …}`) from server pages into `'use client'` chart components — Next.js fails the static-generation step. Use the wrapper pattern in `components/admin/charts/PageWrappers.tsx`.
- **Seed is deterministic** (`mulberry32(0x1337)`). Do NOT introduce wall-clock or non-deterministic randomness in `scripts/seed.ts`. The seed values are referenced by golden-data tests in the future.

## Commit conventions

Prefixes seen in `git log`: `feat(…)`, `fix(…)`, `refactor(…)`, `chore(…)`. Body is bullet-style explaining each surface touched. Last line is the build status (`Build green (29 routes), tsc clean.`).

## What NOT to add unless asked

- Service-worker / PWA / offline mode (this is an internal tool, online-only)
- Real-time / WebSocket dashboards (PRD §2.4 non-goal — hourly grain is enough)
- Mobile-first responsive design (desktop only — staff at desks)
- A/B testing engine, ML churn prediction, NL→SQL queries (PRD §3.4 deferred)
- Mocked customer-facing dashboards (Console is staff-only by design)
