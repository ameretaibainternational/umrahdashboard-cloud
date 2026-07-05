import { getBookings } from '@/lib/db'
import { pkr, formatDate } from '@/lib/formatters'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function CustomersPage() {
  const bookings = await getBookings()

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b bg-muted/20">
        <p className="text-sm text-muted-foreground">{bookings.length} customer record{bookings.length !== 1 ? 's' : ''}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-xs">#</TableHead>
            <TableHead className="text-xs">Customer Name</TableHead>
            <TableHead className="text-xs">Airline</TableHead>
            <TableHead className="text-xs">Pax</TableHead>
            <TableHead className="text-xs">Hotels</TableHead>
            <TableHead className="text-xs text-right">Total</TableHead>
            <TableHead className="text-xs text-right">Paid</TableHead>
            <TableHead className="text-xs text-right">Due</TableHead>
            <TableHead className="text-xs">Date</TableHead>
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground py-12 text-sm">No customers yet.</TableCell>
            </TableRow>
          ) : bookings.map((b, i) => (
            <TableRow key={b.id} className="hover:bg-muted/20">
              <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-medium text-sm">{b.customer_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{b.airline_name}</TableCell>
              <TableCell className="text-sm">{b.adult_count + b.child_count + b.infant_count}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {b.makkah_hotel_name && <span>{b.makkah_hotel_name}</span>}
                {b.madinah_hotel_name && <span className="block">{b.madinah_hotel_name}</span>}
              </TableCell>
              <TableCell className="text-right text-sm font-semibold">{pkr(b.total_pkr)}</TableCell>
              <TableCell className="text-right text-sm text-emerald-600">{pkr(b.paid_pkr)}</TableCell>
              <TableCell className="text-right text-sm text-amber-600">{pkr(b.remaining_pkr)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDate(b.booking_date)}</TableCell>
              <TableCell>
                <Badge variant="outline"
                  className={b.remaining_pkr > 0
                    ? 'text-amber-600 border-amber-200 bg-amber-50 text-[10px]'
                    : 'text-emerald-600 border-emerald-200 bg-emerald-50 text-[10px]'
                  }
                >
                  {b.remaining_pkr > 0 ? 'Due' : 'Paid'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
