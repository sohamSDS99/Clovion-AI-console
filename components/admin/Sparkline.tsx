import { cn } from '@/lib/cn'

export type SparklineProps = {
  values: number[]
  width?: number
  height?: number
  stroke?: number
  className?: string
}

export function Sparkline({
  values,
  width = 60,
  height = 18,
  stroke = 1.25,
  className,
}: SparklineProps) {
  if (!values || values.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn('shrink-0', className)}
        aria-hidden="true"
      />
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const n = values.length
  const stepX = n > 1 ? width / (n - 1) : width

  const points = values.map((v, i) => {
    const x = n > 1 ? i * stepX : width / 2
    const y = height - ((v - min) / span) * height
    return [x, y] as const
  })

  const d = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ')

  const [lx, ly] = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="#000" strokeWidth={stroke} strokeLinejoin="miter" />
      <circle cx={lx} cy={ly} r={2} fill="#000" />
    </svg>
  )
}

export default Sparkline
