/** Soft limit — buffer under Cloudflare R2's 10 GB free tier */
export const STORAGE_SOFT_LIMIT_GB = 9

export const STORAGE_SOFT_LIMIT_BYTES = STORAGE_SOFT_LIMIT_GB * 1024 * 1024 * 1024

export const STORAGE_WARN_RATIO = 0.8   // banner at 80% of soft limit
export const STORAGE_YELLOW_RATIO = 0.7 // progress bar yellow
export const STORAGE_RED_RATIO = 0.9    // progress bar red

export function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return '0 GB'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 0.01) return `${gb.toFixed(2)} GB`
  const mb = bytes / (1024 * 1024)
  if (mb >= 0.01) return `${mb.toFixed(1)} MB`
  const kb = bytes / 1024
  return `${Math.max(kb, 0.1).toFixed(0)} KB`
}

export function storageUsagePercent(totalBytes: number): number {
  return Math.min(100, (totalBytes / STORAGE_SOFT_LIMIT_BYTES) * 100)
}

export function storageBarColor(totalBytes: number): 'green' | 'yellow' | 'red' {
  const ratio = totalBytes / STORAGE_SOFT_LIMIT_BYTES
  if (ratio >= STORAGE_RED_RATIO) return 'red'
  if (ratio >= STORAGE_YELLOW_RATIO) return 'yellow'
  return 'green'
}

export function shouldShowStorageWarning(totalBytes: number): boolean {
  return totalBytes / STORAGE_SOFT_LIMIT_BYTES >= STORAGE_WARN_RATIO
}
