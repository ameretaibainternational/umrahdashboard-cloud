import { getAirlines, getHotels, getVisa, getCurrency, getTransportRates, getCompany, getCurrentStaff, getPackageInvoiceById, getInvoiceClients, getInvoiceSettings } from '@/lib/db'
import { isViewerPermission } from '@/lib/permissions'
import CalculatorForm from '@/components/calculator/CalculatorForm'

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const { edit } = await searchParams
  const [airlines, hotels, visa, currency, transportRates, company, staff, editInvoice, invoiceClients, invoiceSettings] = await Promise.all([
    getAirlines(),
    getHotels(),
    getVisa(),
    getCurrency(),
    getTransportRates(),
    getCompany(),
    getCurrentStaff(),
    edit ? getPackageInvoiceById(edit) : Promise.resolve(null),
    getInvoiceClients(),
    getInvoiceSettings(),
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
      company={company}
      invoiceClients={invoiceClients}
      invoiceSettings={invoiceSettings}
      canSaveBooking={!staff || !isViewerPermission(staff.permission)}
      editInvoice={editInvoice}
    />
  )
}
