'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateBooking } from '@/app/actions/bookings'
import { pkr, formatDate, bookingInvoiceId } from '@/lib/formatters'
import type { Booking } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

type DialogMode = 'view' | 'edit'

interface Props {
  booking: Booking | null
  mode: DialogMode | null
  onClose: () => void
  onEdit?: () => void
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-navy text-left sm:text-right break-words">{value}</span>
    </div>
  )
}

function hotelBlock(prefix: 'Makkah' | 'Madinah', booking: Booking) {
  const isMakkah = prefix === 'Makkah'
  const name = isMakkah ? booking.makkah_hotel_name : booking.madinah_hotel_name
  const location = isMakkah ? booking.makkah_hotel_location : booking.madinah_hotel_location
  const distance = isMakkah ? booking.makkah_hotel_distance : booking.madinah_hotel_distance
  const room = isMakkah ? booking.makkah_room_type : booking.madinah_room_type
  const nights = isMakkah ? booking.makkah_nights : booking.madinah_nights
  if (!name && !nights) return null
  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{prefix}</p>
      <DetailRow label="Hotel" value={name || '—'} />
      {location && <DetailRow label="Location" value={location} />}
      {distance && <DetailRow label="Distance" value={distance} />}
      {room && <DetailRow label="Room" value={room} />}
      {nights != null && <DetailRow label="Nights" value={String(nights)} />}
    </div>
  )
}

interface BookingFormState {
  booking_date: string
  customer_name: string
  airline_name: string
  total_pkr: string
  cost_pkr: string
  paid_pkr: string
  advance_pkr: string
  adult_count: string
  child_count: string
  infant_count: string
  makkah_hotel_name: string
  makkah_hotel_location: string
  makkah_hotel_distance: string
  makkah_room_type: string
  makkah_nights: string
  madinah_hotel_name: string
  madinah_hotel_location: string
  madinah_hotel_distance: string
  madinah_room_type: string
  madinah_nights: string
}

function bookingToForm(b: Booking): BookingFormState {
  return {
    booking_date: b.booking_date,
    customer_name: b.customer_name,
    airline_name: b.airline_name,
    total_pkr: String(b.total_pkr),
    cost_pkr: String(b.cost_pkr),
    paid_pkr: String(b.paid_pkr),
    advance_pkr: String(b.advance_pkr),
    adult_count: String(b.adult_count),
    child_count: String(b.child_count),
    infant_count: String(b.infant_count),
    makkah_hotel_name: b.makkah_hotel_name ?? '',
    makkah_hotel_location: b.makkah_hotel_location ?? '',
    makkah_hotel_distance: b.makkah_hotel_distance ?? '',
    makkah_room_type: b.makkah_room_type ?? '',
    makkah_nights: b.makkah_nights != null ? String(b.makkah_nights) : '',
    madinah_hotel_name: b.madinah_hotel_name ?? '',
    madinah_hotel_location: b.madinah_hotel_location ?? '',
    madinah_hotel_distance: b.madinah_hotel_distance ?? '',
    madinah_room_type: b.madinah_room_type ?? '',
    madinah_nights: b.madinah_nights != null ? String(b.madinah_nights) : '',
  }
}

export default function BookingDialog({ booking, mode, onClose, onEdit }: Props) {
  const router = useRouter()
  const [form, setForm] = useState<BookingFormState | null>(() => (booking ? bookingToForm(booking) : null))
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (booking) setForm(bookingToForm(booking))
  }, [booking])

  if (!booking || !mode || !form) return null

  const total = Number(form.total_pkr) || 0
  const cost = Number(form.cost_pkr) || 0
  const paid = Number(form.paid_pkr) || 0
  const profit = total - cost
  const remaining = Math.max(0, total - paid)

  function setField(key: keyof BookingFormState, value: string) {
    setForm(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form || !booking) return
    const bookingId = booking.id
    startTransition(async () => {
      const result = await updateBooking(bookingId, {
        booking_date: form.booking_date,
        customer_name: form.customer_name.trim(),
        airline_name: form.airline_name.trim(),
        total_pkr: total,
        cost_pkr: cost,
        profit_pkr: profit,
        advance_pkr: Number(form.advance_pkr) || paid,
        paid_pkr: paid,
        remaining_pkr: remaining,
        adult_count: Number(form.adult_count) || 0,
        child_count: Number(form.child_count) || 0,
        infant_count: Number(form.infant_count) || 0,
        makkah_hotel_name: form.makkah_hotel_name || null,
        makkah_hotel_location: form.makkah_hotel_location || null,
        makkah_hotel_distance: form.makkah_hotel_distance || null,
        makkah_room_type: form.makkah_room_type || null,
        makkah_nights: form.makkah_nights ? Number(form.makkah_nights) : null,
        madinah_hotel_name: form.madinah_hotel_name || null,
        madinah_hotel_location: form.madinah_hotel_location || null,
        madinah_hotel_distance: form.madinah_hotel_distance || null,
        madinah_room_type: form.madinah_room_type || null,
        madinah_nights: form.madinah_nights ? Number(form.madinah_nights) : null,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Booking updated.')
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-full max-w-[calc(100%-2rem)] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>{mode === 'view' ? 'View Booking' : 'Edit Booking'}</DialogTitle>
          <p className="text-xs text-muted-foreground font-mono">{bookingInvoiceId(booking.id)}</p>
        </DialogHeader>

        {mode === 'view' ? (
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
            <div className="space-y-4">
              <div>
                <DetailRow label="Customer" value={booking.customer_name} />
                <DetailRow label="Airline" value={booking.airline_name || '—'} />
                <DetailRow label="Booking date" value={formatDate(booking.booking_date)} />
                <DetailRow label="Passengers" value={`${booking.adult_count} adult · ${booking.child_count} child · ${booking.infant_count} infant`} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {hotelBlock('Makkah', booking)}
                {hotelBlock('Madinah', booking)}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 space-y-1 h-fit">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Financials</p>
              <DetailRow label="Total" value={pkr(booking.total_pkr)} />
              <DetailRow label="Cost" value={pkr(booking.cost_pkr)} />
              <DetailRow label="Profit" value={pkr(booking.profit_pkr)} />
              <DetailRow label="Paid" value={pkr(booking.paid_pkr)} />
              <DetailRow label="Remaining" value={pkr(booking.remaining_pkr)} />
            </div>
          </div>
        ) : (
          <form id="booking-edit-form" onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label className="text-xs">Customer name</Label>
                <Input value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Airline</Label>
                <Input value={form.airline_name} onChange={e => setField('airline_name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Booking date</Label>
                <Input type="date" value={form.booking_date} onChange={e => setField('booking_date', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Adults</Label>
                <Input type="number" min={0} value={form.adult_count} onChange={e => setField('adult_count', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Children</Label>
                <Input type="number" min={0} value={form.child_count} onChange={e => setField('child_count', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Infants</Label>
                <Input type="number" min={0} value={form.infant_count} onChange={e => setField('infant_count', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg border bg-muted/20 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Total (PKR)</Label>
                <Input type="number" min={0} value={form.total_pkr} onChange={e => setField('total_pkr', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cost (PKR)</Label>
                <Input type="number" min={0} value={form.cost_pkr} onChange={e => setField('cost_pkr', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Paid (PKR)</Label>
                <Input type="number" min={0} value={form.paid_pkr} onChange={e => setField('paid_pkr', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Advance (PKR)</Label>
                <Input type="number" min={0} value={form.advance_pkr} onChange={e => setField('advance_pkr', e.target.value)} />
              </div>
              <p className="sm:col-span-2 lg:col-span-4 text-xs text-muted-foreground">
                Profit: {pkr(profit)} · Remaining: {pkr(remaining)}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Makkah</p>
                <Input placeholder="Hotel name" value={form.makkah_hotel_name} onChange={e => setField('makkah_hotel_name', e.target.value)} />
                <Input placeholder="Room type" value={form.makkah_room_type} onChange={e => setField('makkah_room_type', e.target.value)} />
                <Input type="number" min={0} placeholder="Nights" value={form.makkah_nights} onChange={e => setField('makkah_nights', e.target.value)} />
              </div>
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Madinah</p>
                <Input placeholder="Hotel name" value={form.madinah_hotel_name} onChange={e => setField('madinah_hotel_name', e.target.value)} />
                <Input placeholder="Room type" value={form.madinah_room_type} onChange={e => setField('madinah_room_type', e.target.value)} />
                <Input type="number" min={0} placeholder="Nights" value={form.madinah_nights} onChange={e => setField('madinah_nights', e.target.value)} />
              </div>
            </div>
          </form>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Close
          </Button>
          {mode === 'view' && onEdit && (
            <Button type="button" onClick={onEdit} className="bg-navy hover:bg-navy-2 text-white ml-2">
              Edit
            </Button>
          )}
          {mode === 'edit' && (
            <Button type="submit" form="booking-edit-form" disabled={isPending} className="bg-navy hover:bg-navy-2 text-white">
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save changes
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
