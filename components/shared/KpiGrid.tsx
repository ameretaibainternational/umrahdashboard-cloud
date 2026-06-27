import { cn } from '@/lib/utils'

type KpiGridColumns = 3 | 4 | 5

/** Responsive column caps — cards stay compact instead of stretching on wide screens. */
const GRID_CLASSES: Record<KpiGridColumns, string> = {
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: [
    'grid-cols-1',
    'sm:grid-cols-2',
    'md:grid-cols-3',
    'lg:grid-cols-4',
    'xl:grid-cols-5',
  ].join(' '),
}

interface KpiGridProps {
  children: React.ReactNode
  columns?: KpiGridColumns
  className?: string
}

/** Responsive grid for KPI stat cards — equal heights, capped column count. */
export default function KpiGrid({ children, columns = 5, className }: KpiGridProps) {
  return (
    <div className={cn('grid w-full gap-3 sm:gap-4 items-stretch', GRID_CLASSES[columns], className)}>
      {children}
    </div>
  )
}

/** Standard page width so dashboard content does not stretch on ultra-wide monitors. */
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl space-y-6', className)}>
      {children}
    </div>
  )
}
