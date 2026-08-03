import { getBookings, getStaff } from '@/lib/db'
import { buildStaffUsernameMap } from '@/lib/staff-lookup'
import BookingsTable from '@/components/bookings/BookingsTable'

export default async function BookingsPage() {
  const [bookings, staff] = await Promise.all([
    getBookings(),
    getStaff(),
  ])
  return <BookingsTable bookings={bookings} staffUsernames={buildStaffUsernameMap(staff)} />
}
