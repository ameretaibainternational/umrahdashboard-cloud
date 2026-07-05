import type { StoredFileRow, StorageUsage } from '@/lib/types'

export function sumStoredFileBytes(files: StoredFileRow[]): number {
  return files.reduce((sum, f) => sum + (f.file_size_bytes ?? 0), 0)
}

export function storageUsageFromFiles(files: StoredFileRow[]): StorageUsage {
  return {
    id: '',
    total_bytes: sumStoredFileBytes(files),
    updated_at: new Date().toISOString(),
  }
}
