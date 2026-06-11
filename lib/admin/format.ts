// Formatting helpers for all KPI/table cells.
// Numerics: tabular-nums classes applied at render site (JetBrains Mono).

const nf = (digits: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })

export function formatNumber(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—'
  return nf(digits).format(n)
}

export function formatCents(cents: number, digits = 0): string {
  if (!Number.isFinite(cents)) return '—'
  const v = cents / 100
  if (Math.abs(v) >= 1_000_000) return `$${nf(1).format(v / 1_000_000)}M`
  if (Math.abs(v) >= 10_000) return `$${nf(0).format(v / 1000)}K`
  return `$${nf(digits).format(v)}`
}

export function formatMoneyUsd(cents: number, digits = 0): string {
  return formatCents(cents, digits)
}

export function formatMicrocents(micro: number, digits = 2): string {
  if (!Number.isFinite(micro)) return '—'
  const cents = micro / 10_000
  return formatCents(cents, digits)
}

export function formatMoneyMicro(micro: number, digits = 2): string {
  return formatMicrocents(micro, digits)
}

export function formatPercent(
  numerator: number,
  denominator?: number,
  digits = 1
): string {
  let v: number
  if (denominator === undefined) {
    v = numerator
  } else {
    if (!denominator) return '—'
    v = numerator / denominator
  }
  if (!Number.isFinite(v)) return '—'
  // If input looks like already-percent (>1.5), don't multiply
  const pct = Math.abs(v) > 1.5 ? v : v * 100
  return `${nf(digits).format(pct)}%`
}

export function formatPct(
  numerator: number,
  denominator?: number,
  digits = 1
): string {
  return formatPercent(numerator, denominator, digits)
}

export function formatDelta(curr: number, prev: number): {
  sign: '+' | '-' | '0'
  text: string
} {
  if (!prev || !Number.isFinite(prev)) return { sign: '0', text: '—' }
  const d = (curr - prev) / Math.abs(prev)
  const sign: '+' | '-' | '0' = d > 0 ? '+' : d < 0 ? '-' : '0'
  return { sign, text: `${sign === '-' ? '' : sign}${nf(1).format(d * 100)}%` }
}

export function fmtDelta(curr: number, prev: number) {
  return formatDelta(curr, prev)
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${nf(1).format(s)}s`
  const m = s / 60
  if (m < 60) return `${nf(1).format(m)}m`
  const h = m / 60
  return `${nf(1).format(h)}h`
}

export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000) return `${nf(2).format(n / 1_000_000)}M`
  if (n >= 1000) return `${nf(1).format(n / 1000)}K`
  return nf(0).format(n)
}

export function formatBenchmark(b: { value: number; label: string }): string {
  return `${nf(1).format(b.value)} — ${b.label}`
}

export function planLabel(
  tier: 'free' | 'starter' | 'growth' | 'enterprise'
): string {
  return { free: 'FREE', starter: 'STARTER', growth: 'GROWTH', enterprise: 'ENT' }[
    tier
  ]
}

export function roleLabel(
  role: 'owner' | 'admin' | 'analyst' | 'support' | 'engineer'
): string {
  return role.toUpperCase()
}

export function fmtMoneyUsd(cents: number) {
  return formatCents(cents)
}
export function fmtMoneyMicro(micro: number) {
  return formatMicrocents(micro)
}
export function fmtPct(num: number, den?: number, digits = 1) {
  return formatPercent(num, den, digits)
}
export function fmtNumber(n: number, digits = 0) {
  return formatNumber(n, digits)
}
