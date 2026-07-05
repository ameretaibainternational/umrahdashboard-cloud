'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Download, Pencil, Trash2, Loader2, Plus } from 'lucide-react'
import { deleteCustomInvoice, deleteCustomInvoices } from '@/app/actions/custom-invoices'
import { downloadStoredPdf } from '@/lib/storage-client'
import { pkr, formatDate } from '@/lib/formatters'
import type { CustomInvoice } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface Props {
  invoices: CustomInvoice[]
  canManage?: boolean
}

export default function CustomInvoicesTable({ invoices, canManage = true }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const allSelected = invoices.length > 0 && invoices.every(inv => selectedIds.has(inv.id))

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(invoices.map(inv => inv.id)) : new Set())
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleDownload(inv: CustomInvoice) {
    if (inv.file_deleted_at) {
      toast.error('PDF file was removed from storage.')
      return
    }
    if (!inv.storage_key) {
      toast.error('No stored PDF for this invoice.')
      return
    }
    setDownloadingId(inv.id)
    try {
      await downloadStoredPdf(inv.id, 'invoice')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloadingId(null)
    }
  }

  function handleDelete(inv: CustomInvoice) {
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return
    setDeletingId(inv.id)
    startTransition(async () => {
      const result = await deleteCustomInvoice(inv.id)
      setDeletingId(null)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Invoice deleted.')
        router.refresh()
      }
    })
  }

  function handleBulkDelete() {
    const ids = [...selectedIds]
    startTransition(async () => {
      const result = await deleteCustomInvoices(ids)
      if ('error' in result && result.error && !('success' in result)) {
        toast.error(result.error)
      } else if ('success' in result && result.success) {
        const count = 'deleted' in result ? result.deleted : ids.length
        toast.success(`${count} invoice${count !== 1 ? 's' : ''} deleted`)
        if ('error' in result && result.error) toast.warning(result.error)
        setSelectedIds(new Set())
        router.refresh()
      }
      setBulkDeleteOpen(false)
    })
  }

  return (
    <>
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b bg-muted/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {invoices.length} custom invoice{invoices.length !== 1 ? 's' : ''}
            </p>
            {canManage && selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
                className="gap-1.5 h-8 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected ({selectedIds.size})
              </Button>
            )}
          </div>
          {canManage && (
            <Link href="/custom-invoices">
              <Button size="sm" className="bg-navy hover:bg-navy-2 text-white gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                New Custom Invoice
              </Button>
            </Link>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">
            No custom invoices yet.{' '}
            {canManage && (
              <Link href="/custom-invoices" className="text-navy underline underline-offset-2">
                Create one
              </Link>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                {canManage && (
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={v => toggleSelectAll(Boolean(v))} />
                  </TableHead>
                )}
                <TableHead className="text-xs">Invoice #</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs text-right">Profit</TableHead>
                <TableHead className="text-xs text-right">Received</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id} className="hover:bg-muted/20">
                  {canManage && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={v => toggleSelect(inv.id, Boolean(v))}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-semibold text-sm text-navy">
                    {inv.billed_to_name ? `${inv.billed_to_name} — ${inv.invoice_number}` : inv.invoice_number}
                  </TableCell>
                  <TableCell className="text-sm">{inv.billed_to_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(inv.invoice_date)}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{pkr(inv.total)}</TableCell>
                  <TableCell className="text-sm text-right text-emerald-600">{pkr(inv.profit_pkr ?? 0)}</TableCell>
                  <TableCell className="text-sm text-right">{pkr(inv.received)}</TableCell>
                  <TableCell>
                    <Badge variant="outline"
                      className={inv.remaining > 0
                        ? 'text-amber-600 border-amber-200 bg-amber-50 text-[10px] h-5'
                        : 'text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px] h-5'}
                    >
                      {inv.remaining > 0 ? 'Due' : 'Paid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canManage && (
                        <Link
                          href={`/custom-invoices?edit=${inv.id}`}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-input bg-background hover:bg-accent"
                        >
                          <Pencil className="w-3 h-3" />
                        </Link>
                      )}
                      {inv.storage_key && !inv.file_deleted_at && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(inv)}
                          disabled={downloadingId === inv.id}
                          className="h-7 w-7 p-0"
                        >
                          {downloadingId === inv.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Download className="w-3 h-3" />}
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(inv)}
                          disabled={deletingId === inv.id || isPending}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                        >
                          {deletingId === inv.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Invoices</DialogTitle>
            <DialogDescription>
              Delete {selectedIds.size} custom invoice{selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
