import { getAirlines, getHotels, getVisa, getCurrency, getTransportRates, getCompany, getCurrentStaff, getPackageInvoiceById, getInvoiceClients, getInvoiceSettings, getAllPackageInvoiceNumbers, getZiarats, getBookingById, getTransportRoutes, getTransportVehicles, getRouteVehicleRates, findBookingForCustomInvoice } from '@/lib/db'
import { isViewerPermission } from '@/lib/permissions'
import CalculatorForm from '@/components/calculator/CalculatorForm'

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; booking_id?: string }>
}) {
  const { edit, booking_id } = await searchParams

  const editInvoice = edit ? await getPackageInvoiceById(edit) : null
  let editBooking = booking_id ? await getBookingById(booking_id) : null
  if (editInvoice && !editBooking) {
    editBooking = await findBookingForCustomInvoice(editInvoice.id, {
      customer_name: editInvoice.billed_to_name,
      booking_date: editInvoice.invoice_date,
      total_pkr: editInvoice.total,
    })
  }

  const [airlines, hotels, visa, currency, transportRates, ziarats, company, staff, invoiceClients, invoiceSettings, packageInvoices, bookingToFinalize, transportRoutes, transportVehicles, routeVehicleRates] = await Promise.all([
    getAirlines(),
    getHotels(),
    getVisa(),
    getCurrency(),
    getTransportRates(),
    getZiarats(),
    getCompany(),
    getCurrentStaff(),
    getInvoiceClients(),
    getInvoiceSettings(),
    getAllPackageInvoiceNumbers(),
    booking_id ? getBookingById(booking_id) : Promise.resolve(null),
    getTransportRoutes(),
    getTransportVehicles(),
    getRouteVehicleRates(),
  ])

  const makkahHotels = hotels.filter(h => h.city === 'Makkah')
  const madinahHotels = hotels.filter(h => h.city === 'Madinah')

  return (
    <CalculatorForm
      airlines={airlines}
      makkahHotels={makkahHotels}
      madinahHotels={madinahHotels}
      visa={visa}
      currency={currency}
      transportRates={transportRates}
      ziarats={ziarats}
      company={company}
      invoiceClients={invoiceClients}
      invoiceSettings={invoiceSettings}
      existingPackageInvoices={packageInvoices}
      canSaveBooking={!staff || !isViewerPermission(staff.permission)}
      editInvoice={editInvoice}
      editBooking={editBooking}
      bookingToFinalize={bookingToFinalize ?? undefined}
      transportRoutes={transportRoutes}
      transportVehicles={transportVehicles}
      routeVehicleRates={routeVehicleRates}
    />
  )
}
