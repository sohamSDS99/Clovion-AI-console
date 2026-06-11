import { cn } from '@/lib/cn'

export type SankeyNode = {
  id: string
  label: string
  value: number
  column: number
  color?: string
}

export type SankeyLink = {
  source: string
  target: string
  value: number
  color?: string
}

export type SankeyProps = {
  nodes: SankeyNode[]
  links: SankeyLink[]
  height?: number
  width?: number
  className?: string
  /** Show value label on the widest link per column. */
  showWidestLinkLabel?: boolean
}

type LaidNode = SankeyNode & {
  x: number
  y: number
  h: number
  w: number
  color: string
}

type LaidLink = Omit<SankeyLink, 'source' | 'target' | 'color'> & {
  source: LaidNode
  target: LaidNode
  sourceY: number
  targetY: number
  thickness: number
  color: string
}

export function Sankey({
  nodes,
  links,
  height = 360,
  width = 960,
  className,
  showWidestLinkLabel = true,
}: SankeyProps) {
  if (nodes.length === 0) {
    return (
      <div className="border border-dashed border-black/15 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50">
        EMPTY
      </div>
    )
  }

  const padTop = 16
  const padBottom = 16
  const padLeft = 16
  const padRight = 140 // room for labels to the right of last column
  const nodeW = 12
  const nodeGap = 4
  const innerH = height - padTop - padBottom
  const innerW = width - padLeft - padRight

  // Group nodes by column
  const cols = new Map<number, SankeyNode[]>()
  nodes.forEach((n) => {
    if (!cols.has(n.column)) cols.set(n.column, [])
    cols.get(n.column)!.push(n)
  })
  const sortedColIdx = [...cols.keys()].sort((a, b) => a - b)
  const numCols = sortedColIdx.length
  const colStep = numCols > 1 ? innerW / (numCols - 1) : innerW

  // Find max total value per column to scale heights
  const colTotal = new Map<number, number>()
  sortedColIdx.forEach((c) => {
    const total = cols.get(c)!.reduce((s, n) => s + n.value, 0)
    colTotal.set(c, total)
  })
  const overallMax = Math.max(...colTotal.values(), 1)

  // value->pixel scale (so the largest column fills innerH minus gaps)
  function scaleFor(colIndex: number): number {
    const nodesInCol = cols.get(colIndex)!.length
    const gaps = Math.max(0, nodesInCol - 1) * nodeGap
    const usable = innerH - gaps
    // scale relative to overall maximum column value (uniform across cols)
    return usable / overallMax
  }

  // Lay out nodes deterministically: sort within column desc by value
  const laid: Record<string, LaidNode> = {}
  sortedColIdx.forEach((c, ci) => {
    const list = [...cols.get(c)!].sort((a, b) => b.value - a.value)
    const s = scaleFor(c)
    const x = padLeft + (numCols > 1 ? ci * colStep : innerW / 2)
    let y = padTop
    list.forEach((n) => {
      const h = Math.max(4, n.value * s)
      laid[n.id] = {
        ...n,
        x,
        y,
        h,
        w: nodeW,
        color: n.color ?? '#000',
      }
      y += h + nodeGap
    })
  })

  // Lay out links — group by source (left side) and target (right side), order by node order
  const outgoing = new Map<string, SankeyLink[]>()
  const incoming = new Map<string, SankeyLink[]>()
  links.forEach((l) => {
    if (!outgoing.has(l.source)) outgoing.set(l.source, [])
    outgoing.get(l.source)!.push(l)
    if (!incoming.has(l.target)) incoming.set(l.target, [])
    incoming.get(l.target)!.push(l)
  })

  // For each source, compute fraction-of-node thickness and stack y from top of node
  const sourceY = new Map<string, number>() // current y cursor per source
  const targetY = new Map<string, number>() // current y cursor per target
  Object.keys(laid).forEach((id) => {
    sourceY.set(id, laid[id].y)
    targetY.set(id, laid[id].y)
  })

  // Pre-sort link lists so layout is deterministic — by target column then target order
  const orderInCol = new Map<string, number>()
  sortedColIdx.forEach((c) => {
    const list = [...cols.get(c)!].sort((a, b) => b.value - a.value)
    list.forEach((n, i) => orderInCol.set(n.id, i))
  })

  outgoing.forEach((list) => {
    list.sort((a, b) => {
      const ta = laid[a.target]?.column ?? 0
      const tb = laid[b.target]?.column ?? 0
      if (ta !== tb) return ta - tb
      return (orderInCol.get(a.target) ?? 0) - (orderInCol.get(b.target) ?? 0)
    })
  })
  incoming.forEach((list) => {
    list.sort((a, b) => {
      const sa = laid[a.source]?.column ?? 0
      const sb = laid[b.source]?.column ?? 0
      if (sa !== sb) return sa - sb
      return (orderInCol.get(a.source) ?? 0) - (orderInCol.get(b.source) ?? 0)
    })
  })

  const laidLinks: LaidLink[] = []

  // Walk outgoing in deterministic order
  outgoing.forEach((list, srcId) => {
    const src = laid[srcId]
    if (!src) return
    const srcScale = scaleFor(src.column)
    list.forEach((l) => {
      const tgt = laid[l.target]
      if (!tgt) return
      const tgtScale = scaleFor(tgt.column)
      const thickness = Math.max(1, l.value * Math.min(srcScale, tgtScale))
      const sy = sourceY.get(srcId)!
      const ty = targetY.get(l.target)!
      sourceY.set(srcId, sy + thickness)
      targetY.set(l.target, ty + thickness)
      laidLinks.push({
        value: l.value,
        source: src,
        target: tgt,
        sourceY: sy + thickness / 2,
        targetY: ty + thickness / 2,
        thickness,
        color: l.color ?? src.color ?? '#000',
      })
    })
  })

  // Determine the widest link in each column (between col i and i+1)
  const widestPerCol = new Map<number, LaidLink>()
  laidLinks.forEach((l) => {
    const c = l.source.column
    const cur = widestPerCol.get(c)
    if (!cur || l.value > cur.value) widestPerCol.set(c, l)
  })

  // Gradient ids per link
  function bezierPath(l: LaidLink): string {
    const x1 = l.source.x + l.source.w
    const x2 = l.target.x
    const y1 = l.sourceY
    const y2 = l.targetY
    const dx = (x2 - x1) / 2
    const h = l.thickness
    // Build a thick area band using two cubic curves
    const top1 = y1 - h / 2
    const bot1 = y1 + h / 2
    const top2 = y2 - h / 2
    const bot2 = y2 + h / 2
    return [
      `M ${x1.toFixed(2)} ${top1.toFixed(2)}`,
      `C ${(x1 + dx).toFixed(2)} ${top1.toFixed(2)}, ${(x2 - dx).toFixed(
        2,
      )} ${top2.toFixed(2)}, ${x2.toFixed(2)} ${top2.toFixed(2)}`,
      `L ${x2.toFixed(2)} ${bot2.toFixed(2)}`,
      `C ${(x2 - dx).toFixed(2)} ${bot2.toFixed(2)}, ${(x1 + dx).toFixed(
        2,
      )} ${bot1.toFixed(2)}, ${x1.toFixed(2)} ${bot1.toFixed(2)}`,
      'Z',
    ].join(' ')
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          {laidLinks.map((l, i) => (
            <linearGradient
              key={`sl-${i}`}
              id={`sk-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={l.source.x + l.source.w}
              y1={l.sourceY}
              x2={l.target.x}
              y2={l.targetY}
            >
              <stop offset="0%" stopColor={l.source.color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={l.target.color} stopOpacity={0.7} />
            </linearGradient>
          ))}
        </defs>

        {/* Links first so nodes overlay */}
        {laidLinks.map((l, i) => (
          <path key={`lk-${i}`} d={bezierPath(l)} fill={`url(#sk-${i})`} />
        ))}

        {/* Nodes */}
        {Object.values(laid).map((n) => (
          <g key={`n-${n.id}`}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={n.color} />
            <text
              x={n.x + n.w + 5}
              y={n.y + 9}
              fontSize="10"
              fontFamily="ui-monospace, 'JetBrains Mono', monospace"
              fill="#000"
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
              {n.label}
            </text>
            <text
              x={n.x + n.w + 5}
              y={n.y + 20}
              fontSize="9.5"
              fontFamily="ui-monospace, 'JetBrains Mono', monospace"
              fill="#000"
              fillOpacity={0.5}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {n.value.toLocaleString('en-US')}
            </text>
          </g>
        ))}

        {/* Widest link labels per column */}
        {showWidestLinkLabel
          ? [...widestPerCol.values()].map((l, i) => {
              const inboundTotal =
                cols.get(l.source.column)?.reduce((s, n) => s + n.value, 0) ?? 0
              const pct = inboundTotal > 0 ? l.value / inboundTotal : 0
              const cx =
                (l.source.x + l.source.w + l.target.x) / 2 -
                (l.target.x - (l.source.x + l.source.w)) * 0.05
              const cy = (l.sourceY + l.targetY) / 2 - l.thickness / 2 - 4
              return (
                <text
                  key={`wl-${i}`}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontFamily="ui-monospace, 'JetBrains Mono', monospace"
                  fill="#000"
                  fillOpacity={0.7}
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.08em',
                  }}
                >
                  {`${(pct * 100).toFixed(0)}% — ${l.value.toLocaleString('en-US')}`}
                </text>
              )
            })
          : null}
      </svg>
    </div>
  )
}

export default Sankey
