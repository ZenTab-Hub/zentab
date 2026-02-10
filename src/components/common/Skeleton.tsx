import { cn } from '@/utils/cn'

/* ─── Base Skeleton ─── */
interface SkeletonProps {
  className?: string
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
)

/* ─── Table Skeleton ─── */
interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
}

export const TableSkeleton = ({ rows = 8, columns = 5, className }: TableSkeletonProps) => (
  <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
    {/* Header */}
    <div className="flex gap-3 px-4 py-3 bg-muted/50 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex gap-3 px-4 py-3 border-b last:border-0">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={c} className={cn('h-3 flex-1', c === 0 && 'max-w-[120px]')} />
        ))}
      </div>
    ))}
  </div>
)

/* ─── Card Grid Skeleton ─── */
interface CardSkeletonProps {
  cards?: number
  className?: string
}

export const CardGridSkeleton = ({ cards = 6, className }: CardSkeletonProps) => (
  <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3', className)}>
    {Array.from({ length: cards }).map((_, i) => (
      <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-2.5 w-full" />
        <Skeleton className="h-2.5 w-4/5" />
      </div>
    ))}
  </div>
)

/* ─── Stats Dashboard Skeleton ─── */
export const StatsSkeleton = ({ className }: SkeletonProps) => (
  <div className={cn('space-y-4', className)}>
    {/* Stat cards row */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-2 w-12" />
        </div>
      ))}
    </div>
    {/* Chart area */}
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-[180px] w-full rounded-md" />
    </div>
  </div>
)

/* ─── Form / Detail Skeleton ─── */
export const FormSkeleton = ({ className }: SkeletonProps) => (
  <div className={cn('space-y-4 p-4', className)}>
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="space-y-1.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    ))}
  </div>
)

/* ─── Sidebar Tree Skeleton ─── */
export const SidebarSkeleton = ({ className }: SkeletonProps) => (
  <div className={cn('space-y-1 px-2', className)}>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="flex items-center gap-2 px-2 py-1.5">
        <Skeleton className="h-3 w-3 rounded-sm" />
        <Skeleton className={cn('h-2.5', i % 3 === 0 ? 'w-24' : i % 3 === 1 ? 'w-20' : 'w-16')} />
      </div>
    ))}
  </div>
)

/* ─── Page Skeleton (for lazy loading fallback) ─── */
export const PageSkeleton = () => (
  <div className="flex flex-col h-full p-4 space-y-4">
    {/* Toolbar */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-48 rounded-md" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
    {/* Content */}
    <TableSkeleton rows={10} columns={5} className="flex-1" />
  </div>
)

