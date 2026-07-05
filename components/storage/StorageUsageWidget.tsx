'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  STORAGE_SOFT_LIMIT_GB,
  formatStorageBytes,
  storageBarColor,
  storageUsagePercent,
} from '@/lib/storage-config'

interface StorageUsageWidgetProps {
  totalBytes: number
  compact?: boolean
  className?: string
}

export default function StorageUsageWidget({ totalBytes, compact, className }: StorageUsageWidgetProps) {
  const pct = storageUsagePercent(totalBytes)
  const color = storageBarColor(totalBytes)
  const barClass =
    color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'

  if (compact) {
    return (
      <Link
        href="/settings/storage"
        className={cn('flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors', className)}
        title="Storage usage"
      >
        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${pct}%` }} />
        </div>
        <span>{formatStorageBytes(totalBytes)} / {STORAGE_SOFT_LIMIT_GB} GB</span>
      </Link>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-navy">Cloud Storage</p>
          <p className="text-xs text-muted-foreground">PDF files for invoices &amp; vouchers (R2)</p>
        </div>
        <p className="text-sm font-medium tabular-nums">
          {formatStorageBytes(totalBytes)}
          <span className="text-muted-foreground font-normal"> / {STORAGE_SOFT_LIMIT_GB} GB</span>
        </p>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {pct.toFixed(1)}% of soft limit used ·{' '}
        <Link href="/settings/storage" className="text-navy underline-offset-2 hover:underline">
          Manage storage
        </Link>
      </p>
    </div>
  )
}
