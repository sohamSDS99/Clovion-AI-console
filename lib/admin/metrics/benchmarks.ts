// PRD §A.11 benchmark provenance — render-ready for the Settings dictionary page.
// Powers benchmark labels rendered under anchor KPI tiles.

export type BenchmarkSource = {
  source: string
  vintage: string
  sample: string
  supplies: string
  confidence: 'high' | 'medium' | 'low'
}

export const BENCHMARK_PROVENANCE: BenchmarkSource[] = [
  {
    source: 'Benchmarkit / Pavilion 2025 B2B SaaS Benchmarks',
    vintage: 'CY-2024 (pub. 2025)',
    sample: '1,600+ companies (NRR n=228)',
    supplies: 'NRR 101%, GRR 88%, CAC ratio $2.00/$2.82, expansion 40%',
    confidence: 'high',
  },
  {
    source: 'High Alpha × Growth Unhinged 9th annual',
    vintage: 'Surveyed Aug-Sep 2025',
    sample: '800+ self-reported, US $5-20M ARR skew',
    supplies: 'Anchor-KPI quadrant; $10-25k ACV band 106% NRR',
    confidence: 'high',
  },
  {
    source: 'SaaS Capital 2025 retention research',
    vintage: '2025',
    sample: 'Private SaaS panel',
    supplies: 'NRR/GRR dispersion by segment & ACV',
    confidence: 'high',
  },
  {
    source: 'ChartMogul retention reports',
    vintage: '2024 edition',
    sample: '2,500+ SaaS (SMB-skew)',
    supplies: 'NRR > 100% → 1.5-3× growth (free-to-paid 8% claim refuted)',
    confidence: 'high',
  },
  {
    source: 'Mixpanel State of Digital Analytics',
    vintage: 'May 2026',
    sample: '12k+ companies, ~3.7T events',
    supplies: 'B2B DAU/MAU ≈ 31%',
    confidence: 'medium',
  },
  {
    source: 'Amplitude engagement playbook',
    vintage: 'stable 2019-2026',
    sample: 'methodology',
    supplies: 'critical-event active-user rule; stickiness window rule; L7/L28',
    confidence: 'high',
  },
  {
    source: 'Google SRE Book / Workbook',
    vintage: 'canonical',
    sample: 'methodology',
    supplies: 'four golden signals; percentile histograms; ratio SLIs; 28d windows',
    confidence: 'high',
  },
  {
    source: 'web.dev',
    vintage: 'current',
    sample: 'Google-documented',
    supplies: 'CWV thresholds (LCP 2.5s / INP 200ms / CLS 0.1 at p75)',
    confidence: 'high',
  },
  {
    source: 'Langfuse / Helicone docs',
    vintage: 'June 2026',
    sample: 'vendor docs, cross-corroborated',
    supplies: 'LLM cost capture precedence (ingested > inferred); tagging pattern',
    confidence: 'high',
  },
]
