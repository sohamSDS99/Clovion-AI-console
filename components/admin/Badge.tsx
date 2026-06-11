import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'solid' | 'outline' | 'ghost'

export type BadgeProps = {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const VARIANT: Record<BadgeVariant, string> = {
  solid: 'bg-black text-white',
  outline: 'border border-black text-black',
  ghost: 'text-black/55',
}

export function Badge({ variant = 'solid', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.12em] tabular-nums px-1.5 py-0.5 leading-none',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}

export default Badge
