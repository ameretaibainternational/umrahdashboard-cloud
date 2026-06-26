'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addPayment } from '@/app/actions/accounts'
import { pkr } from '@/lib/formatters'
import type { Booking } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, PlusCircle } from 'lucide-react'

interface Props {
  bookings: Booking[]
}

export default function AddPaymentForm({ bookings }: Props) {
  const [bookingId, setBookingId] = useState(bookings[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Cash')
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedBooking = bookings.find(b => b.id === bookingId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return

    const formData = new FormData()
    formData.set('booking_id', bookingId)
    formData.set('amount_pkr', amount)
    formData.set('method', method)
    formData.set('note', note)

    startTransition(async () => {
      const result = await addPayment(formData)
      if ('error' in result && result.error) {
        toast.error(result.error)
      } else {
        toast.success('Payment recorded!')
        setAmount('')
        setNote('')
      }
    })
  }

  return (
    <Card className="shadow-sm border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <PlusCircle className="w-4 h-4" />
          Record Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Booking / Customer</Label>
            <Select value={bookingId} onValueChange={v => v && setBookingId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {bookings.find(b => b.id === bookingId)?.customer_name ?? 'Select booking'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[320px] !w-auto">
                {bookings.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.customer_name} — {pkr(b.remaining_pkr)} due
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBooking && (
              <p className="text-[11px] text-muted-foreground">
                Total: {pkr(selectedBooking.total_pkr)} · Paid: {pkr(selectedBooking.paid_pkr)} · Due: {pkr(selectedBooking.remaining_pkr)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Amount (PKR)</Label>
            <Input
              type="number" min={1} placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Method</Label>
            <Select value={method} onValueChange={v => v && setMethod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Cash', 'Bank', 'JazzCash', 'EasyPaisa'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 md:col-span-3 space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Input
              placeholder="e.g. Advance payment via JazzCash"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isPending || !amount}
              className="w-full bg-navy hover:bg-navy-2 text-white"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Payment'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
