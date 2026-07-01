import { notFound, redirect } from 'next/navigation'
import { getVisa, getCurrency, getTransportRates, getAirlines, getHotels, getCompany, getCurrentStaff, getStorageUsage, getStoredFiles, getInvoiceSettings, getInvoiceClients, getInvoicePaymentMethods, getInvoiceServices, getZiarats, getHotelContacts } from '@/lib/db'
import { isAdminPermission } from '@/lib/permissions'
import SettingsNav from '@/components/settings/SettingsNav'
import VisaForm from '@/components/settings/VisaForm'
import AirlinesForm from '@/components/settings/AirlinesForm'
import TransportForm from '@/components/settings/TransportForm'
import HotelsForm from '@/components/settings/HotelsForm'
import HotelContactsForm from '@/components/settings/HotelContactsForm'
import ZiaratsForm from '@/components/settings/ZiaratsForm'
import CurrencyForm from '@/components/settings/CurrencyForm'
import CompanyForm from '@/components/settings/CompanyForm'
import InvoiceSettingsForm from '@/components/settings/InvoiceSettingsForm'
import InvoiceClientsForm from '@/components/settings/InvoiceClientsForm'
import InvoicePaymentMethodsForm from '@/components/settings/InvoicePaymentMethodsForm'
import InvoiceServicesForm from '@/components/settings/InvoiceServicesForm'
import FlightCitiesForm from '@/components/settings/FlightCitiesForm'
import StorageManagement from '@/components/storage/StorageManagement'

const VALID_TABS = ['visa', 'tickets', 'transport', 'hotels', 'hotel-contacts', 'ziarats', 'flight-cities', 'currency', 'company', 'invoices', 'storage']

export default async function SettingsPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params
  if (!VALID_TABS.includes(tab)) notFound()

  const current = await getCurrentStaff()
  if (!current || !isAdminPermission(current.permission)) redirect('/dashboard')

  const [visa, currency, transportRates, airlines, hotels, company, invoiceSettings, invoiceClients, invoicePaymentMethods, invoiceServices, ziarats, hotelContacts, storageUsage, storedFiles] = await Promise.all([
    getVisa(),
    getCurrency(),
    getTransportRates(),
    getAirlines(),
    getHotels(),
    getCompany(),
    tab === 'invoices' ? getInvoiceSettings() : Promise.resolve(null),
    tab === 'invoices' ? getInvoiceClients() : Promise.resolve([]),
    tab === 'invoices' ? getInvoicePaymentMethods() : Promise.resolve([]),
    tab === 'invoices' ? getInvoiceServices() : Promise.resolve([]),
    tab === 'ziarats' ? getZiarats() : Promise.resolve([]),
    tab === 'hotel-contacts' ? getHotelContacts() : Promise.resolve([]),
    tab === 'storage' ? getStorageUsage() : Promise.resolve({ id: '', total_bytes: 0 }),
    tab === 'storage' ? getStoredFiles() : Promise.resolve([]),
  ])

  return (
    <div>
      <SettingsNav />
      {tab === 'visa'      && <VisaForm visa={visa} />}
      {tab === 'tickets'   && <AirlinesForm airlines={airlines} />}
      {tab === 'transport' && <TransportForm rates={transportRates} />}
      {tab === 'hotels'    && <HotelsForm hotels={hotels} />}
      {tab === 'hotel-contacts' && <HotelContactsForm contacts={hotelContacts} />}
      {tab === 'ziarats'   && <ZiaratsForm ziarats={ziarats} />}
      {tab === 'flight-cities' && <FlightCitiesForm company={company} />}
      {tab === 'currency'  && <CurrencyForm currency={currency} />}
      {tab === 'company'   && <CompanyForm company={company} />}
      {tab === 'invoices'  && invoiceSettings && (
        <div className="space-y-6">
          <InvoiceClientsForm clients={invoiceClients} />
          <InvoicePaymentMethodsForm methods={invoicePaymentMethods} />
          <InvoiceServicesForm services={invoiceServices} />
          <InvoiceSettingsForm settings={invoiceSettings} />
        </div>
      )}
      {tab === 'storage'   && <StorageManagement files={storedFiles} totalBytes={storageUsage.total_bytes} />}
    </div>
  )
}
