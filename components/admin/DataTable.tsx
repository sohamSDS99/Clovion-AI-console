import React from 'react'
import { cn } from '@/lib/cn'

/**
 * Server-rendered table component. Cells are resolved server-side so cell
 * functions never cross the client boundary. Sort is one-time (initialSorting)
 * computed in JS at render time. For interactive sort or filtering, wrap in a
 * dedicated client component.
 */

export type SortDir = 'asc' | 'desc'
export type SortRule = { id: string; desc: boolean }

export type ColumnDef<T, _V = unknown> = {
  id?: string
  header: React.ReactNode
  accessorKey?: keyof T | string
  accessorFn?: (row: T) => unknown
  cell?: (ctx: {
    row: { original: T; index: number }
    getValue: <V = unknown>() => V
  }) => React.ReactNode
}

export type DataTableProps<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  emptyMessage?: string
  className?: string
  stickyHeader?: boolean
  rowHeight?: number
  initialSorting?: SortRule[]
  rowKey?: (row: T, index: number) => string
}

function resolveValue<T>(col: ColumnDef<T>, row: T): unknown {
  if (col.accessorFn) return col.accessorFn(row)
  if (col.accessorKey != null) {
    return (row as Record<string, unknown>)[col.accessorKey as string]
  }
  return undefined
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export function DataTable<T>({
  data,
  columns,
  emptyMessage = 'EMPTY',
  className,
  stickyHeader = true,
  rowHeight = 28,
  initialSorting,
  rowKey,
}: DataTableProps<T>) {
  const cols = columns
  const sortRule = initialSorting && initialSorting[0]
  const sortCol = sortRule
    ? cols.find((c) => (c.id ?? c.accessorKey) === sortRule.id)
    : undefined

  let rows = data
  if (sortCol) {
    const dir = sortRule!.desc ? -1 : 1
    rows = [...data].sort((a, b) => {
      const va = resolveValue(sortCol, a)
      const vb = resolveValue(sortCol, b)
      return compare(va, vb) * dir
    })
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'border border-dashed border-black/10 py-6 text-center text-[11px] font-mono uppercase tracking-[0.12em] text-black/50',
          className,
        )}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-[11px] tabular-nums">
        <thead className={cn(stickyHeader ? 'sticky top-0 bg-paper z-10' : '')}>
          <tr className="border-b border-black/15">
            {cols.map((col, i) => {
              const key = (col.id ?? (col.accessorKey as string) ?? String(i)) + '-h'
              return (
                <th
                  key={key}
                  className="text-left px-2 py-1.5 text-[9.5px] uppercase tracking-[0.12em] font-mono text-black/55 font-normal"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {col.header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => {
            const rk = rowKey ? rowKey(row, rIdx) : String(rIdx)
            return (
              <tr
                key={rk}
                className="border-b border-black/5"
                style={{ height: rowHeight }}
              >
                {cols.map((col, cIdx) => {
                  const ck =
                    rk + '-' + (col.id ?? (col.accessorKey as string) ?? String(cIdx))
                  const value = resolveValue(col, row)
                  const content = col.cell
                    ? col.cell({
                        row: { original: row, index: rIdx },
                        getValue: <V,>() => value as V,
                      })
                    : (value as React.ReactNode)
                  return (
                    <td
                      key={ck}
                      className="px-2 align-middle"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {content}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
