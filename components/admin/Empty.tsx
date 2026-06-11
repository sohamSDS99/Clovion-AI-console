import { cn } from '@/lib/cn'

export type EmptyProps = {
  message?: string
  className?: string
}

export function Empty({ message = 'EMPTY', className }: EmptyProps) {
  return (
    <div
      className={cn(
        'border border-dashed border-black/15 py-6 px-4 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50',
        className,
      )}
    >
      {message}
    </div>
  )
}

export default Empty
