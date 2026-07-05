import { getBookings } from '@/lib/db'
import BookingsTable from '@/components/bookings/BookingsTable'

export default async function BookingsPage() {
  const bookings = await getBookings()
  return <BookingsTable bookings={bookings} />
}
