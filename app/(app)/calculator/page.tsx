import { getAirlines, getHotels, getVisa, getCurrency, getTransportRates, getCompany, getCurrentStaff } from '@/lib/db'
import { isViewerPermission } from '@/lib/permissions'
import CalculatorForm from '@/components/calculator/CalculatorForm'

export default async function CalculatorPage() {
  const [airlines, hotels, visa, currency, transportRates, company, staff] = await Promise.all([
    getAirlines(),
    getHotels(),
    getVisa(),
    getCurrency(),
    getTransportRates(),
    getCompany(),
    getCurrentStaff(),
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
      canSaveBooking={!staff || !isViewerPermission(staff.permission)}
    />
  )
}
