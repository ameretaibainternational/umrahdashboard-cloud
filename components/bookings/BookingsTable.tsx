'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { deleteBooking, deleteBookings } from '@/app/actions/bookings'
import { pkr, formatDate, bookingInvoiceId } from '@/lib/formatters'
import type { Booking } from '@/lib/types'
import BookingDialog from '@/components/bookings/BookingDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Search, Loader2, Eye, Pencil } from 'lucide-react'

interface Props {
  bookings: Booking[]
}

export default function BookingsTable({ bookings }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [dialogBooking, setDialogBooking] = useState<Booking | null>(null)
  const [dialogMode, setDialogMode] = useState<'view' | 'edit' | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = bookings.filter(b =>
    b.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    b.airline_name.toLowerCase().includes(search.toLowerCase())
  )

  const allFilteredSelected = filtered.length > 0 && filtered.every(b => selectedIds.has(b.id))

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(filtered.map(b => b.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function openDialog(booking: Booking, mode: 'view' | 'edit') {
    setDialogBooking(booking)
    setDialogMode(mode)
  }

  function closeDialog() {
    setDialogBooking(null)
    setDialogMode(null)
  }

  function handleDelete() {
    if (!deleteId) return
    startTransition(async () => {
      const result = await deleteBooking(deleteId)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Booking deleted')
        router.refresh()
      }
      setDeleteId(null)
    })
  }

  function handleBulkDelete() {
    const ids = [...selectedIds]
    startTransition(async () => {
      const result = await deleteBookings(ids)
      if ('error' in result && result.error && !('success' in result)) {
        toast.error(result.error)
      } else if ('success' in result && result.success) {
        const count = 'deleted' in result ? result.deleted : ids.length
        toast.success(`${count} booking${count !== 1 ? 's' : ''} deleted`)
        if ('error' in result && result.error) toast.warning(result.error)
        setSelectedIds(new Set())
        router.refresh()
      }
      setBulkDeleteOpen(false)
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or airline…"
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setBulkDeleteOpen(true)}
            className="gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedIds.size})
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={checked => toggleSelectAll(checked === true)}
                  aria-label="Select all bookings"
                />
              </TableHead>
              <TableHead className="text-xs">Invoice</TableHead>
              <TableHead className="text-xs">Customer</TableHead>
              <TableHead className="text-xs">Airline</TableHead>
              <TableHead className="text-xs">Pax</TableHead>
              <TableHead className="text-xs text-right">Total</TableHead>
              <TableHead className="text-xs text-right">Paid</TableHead>
              <TableHead className="text-xs text-right">Due</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-12 text-sm">
                  {search ? 'No bookings match your search' : 'No bookings yet. Create your first package!'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => (
                <TableRow key={b.id} className="hover:bg-muted/20">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(b.id)}
                      onCheckedChange={checked => toggleSelect(b.id, checked === true)}
                      aria-label={`Select booking ${bookingInvoiceId(b)}`}
                    />
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{bookingInvoiceId(b)}</TableCell>
                  <TableCell className="font-medium text-sm">{b.customer_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.airline_name}</TableCell>
                  <TableCell className="text-sm">{b.adult_count + b.child_count + b.infant_count}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{pkr(b.total_pkr)}</TableCell>
                  <TableCell className="text-right text-sm text-emerald-600">{pkr(b.paid_pkr)}</TableCell>
                  <TableCell className="text-right text-sm text-amber-600">{pkr(b.remaining_pkr)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(b.booking_date)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={b.remaining_pkr > 0
                        ? 'text-amber-600 border-amber-200 bg-amber-50 text-[10px]'
                        : 'text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]'
                      }
                    >
                      {b.remaining_pkr > 0 ? 'Due' : 'Paid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="View"
                        onClick={() => openDialog(b, 'view')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Edit"
                        onClick={() => openDialog(b, 'edit')}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                        title="Delete"
                        onClick={() => setDeleteId(b.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <BookingDialog
        booking={dialogBooking}
        mode={dialogMode}
        onClose={closeDialog}
        onEdit={() => setDialogMode('edit')}
      />

      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Booking</DialogTitle>
            <DialogDescription>
              This will permanently delete the booking and all associated payments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={open => !open && setBulkDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Bookings</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedIds.size} booking{selectedIds.size !== 1 ? 's' : ''} and all associated payments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete {selectedIds.size} Booking{selectedIds.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
