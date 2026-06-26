'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import StorageUsageWidget from '@/components/storage/StorageUsageWidget'
import { softDeleteStoredFiles } from '@/app/actions/storage'
import { downloadStorageZip } from '@/lib/storage-client'
import { formatFileSize } from '@/lib/pdf-utils'
import type { StoredFileRow } from '@/lib/types'

interface StorageManagementProps {
  files: StoredFileRow[]
  totalBytes: number
}

export default function StorageManagement({ files, totalBytes }: StorageManagementProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [downloadedSelection, setDownloadedSelection] = useState<string>('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState<'download' | 'delete' | null>(null)

  const selectionKey = useMemo(
    () => [...selected].sort().join(','),
    [selected],
  )

  const allIds = files.map(f => `${f.type}:${f.id}`)
  const allSelected = files.length > 0 && selected.size === files.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedItems = files
    .filter(f => selected.has(`${f.type}:${f.id}`))
    .map(f => ({ id: f.id, type: f.type }))

  const canDelete = selectedItems.length > 0 && downloadedSelection === selectionKey

  async function handleBulkDownload() {
    if (selectedItems.length === 0) {
      toast.error('Select at least one file.')
      return
    }
    setBusy('download')
    try {
      downloadStorageZip(selectedItems)
      setDownloadedSelection(selectionKey)
      toast.success('ZIP download started — save the file before deleting.')
    } catch {
      toast.error('Could not start download.')
    } finally {
      setBusy(null)
    }
  }

  async function handleBulkDelete() {
    setBusy('delete')
    try {
      const result = await softDeleteStoredFiles(selectedItems)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Removed ${selectedItems.length} file(s) from cloud storage.`)
      setSelected(new Set())
      setDownloadedSelection('')
      setConfirmOpen(false)
      router.refresh()
    } catch {
      toast.error('Delete failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <StorageUsageWidget totalBytes={totalBytes} />

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stored PDF Files</CardTitle>
          <p className="text-xs text-muted-foreground">
            Oldest files listed first — download a backup, then delete to free space. Records stay in history; only the PDF is removed.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No stored PDF files yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={selectedItems.length === 0 || busy !== null}
                  onClick={handleBulkDownload}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Selected
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={!canDelete || busy !== null}
                  onClick={() => setConfirmOpen(true)}
                  title={!canDelete ? 'Download selected files first' : undefined}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3 w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                      <th className="p-3 font-medium">Type</th>
                      <th className="p-3 font-medium">Number</th>
                      <th className="p-3 font-medium">Name</th>
                      <th className="p-3 font-medium">Date</th>
                      <th className="p-3 font-medium text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {files.map(file => {
                      const key = `${file.type}:${file.id}`
                      return (
                        <tr key={key} className="hover:bg-muted/30">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              onChange={() => toggle(key)}
                              aria-label={`Select ${file.number}`}
                            />
                          </td>
                          <td className="p-3 capitalize">{file.type === 'invoice' ? 'Invoice' : 'Voucher'}</td>
                          <td className="p-3 font-medium text-navy">{file.number}</td>
                          <td className="p-3 text-muted-foreground">{file.label || '—'}</td>
                          <td className="p-3">{file.date}</td>
                          <td className="p-3 text-right tabular-nums">{formatFileSize(file.file_size_bytes)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedItems.length} stored file(s)?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the PDF from cloud storage. Invoice and voucher records will remain, marked as file removed. Make sure you have downloaded a backup.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy === 'delete'}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy === 'delete'}
              onClick={handleBulkDelete}
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete from storage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
