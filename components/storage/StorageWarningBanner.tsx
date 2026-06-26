'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import {
  STORAGE_SOFT_LIMIT_GB,
  formatStorageBytes,
  shouldShowStorageWarning,
} from '@/lib/storage-config'

const DISMISS_KEY = 'ft_storage_warn_dismissed_at'

interface StorageWarningBannerProps {
  totalBytes: number
}

export default function StorageWarningBanner({ totalBytes }: StorageWarningBannerProps) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (!shouldShowStorageWarning(totalBytes)) {
      setDismissed(true)
      return
    }
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY)
      const dismissedAt = raw ? Number(raw) : 0
      // Re-show if dismissed more than 30 minutes ago or usage changed session
      setDismissed(Date.now() - dismissedAt < 30 * 60 * 1000)
    } catch {
      setDismissed(false)
    }
  }, [totalBytes])

  if (!shouldShowStorageWarning(totalBytes) || dismissed) return null

  function handleDismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2 flex-shrink-0">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 flex-1">
        Storage is almost full ({formatStorageBytes(totalBytes)} of {STORAGE_SOFT_LIMIT_GB} GB used).{' '}
        <Link href="/settings/storage" className="font-semibold underline underline-offset-2">
          Free up space
        </Link>
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-amber-600 hover:text-amber-800 p-0.5"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
