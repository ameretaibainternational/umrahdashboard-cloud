import { getInvoiceSettings, getAllInvoiceNumbers, getInvoiceClients, getInvoicePaymentMethods, getInvoiceServices, getCustomInvoiceById, getPackageInvoiceById, getCurrency } from '@/lib/db'
import CustomInvoiceForm from '@/components/custom-invoice/CustomInvoiceForm'
import { FileText, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

export default async function CustomInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const { edit } = await searchParams

  const editInvoice = edit ? await getCustomInvoiceById(edit) : null
  if (edit && !editInvoice) {
    const packageInvoice = await getPackageInvoiceById(edit)
    if (packageInvoice) redirect(`/calculator?edit=${edit}`)
  }

  const [settings, invoiceNumbers, savedClients, paymentMethods, services, currency] = await Promise.all([
    getInvoiceSettings(),
    getAllInvoiceNumbers(),
    getInvoiceClients(),
    getInvoicePaymentMethods(),
    getInvoiceServices(),
    getCurrency(),
  ])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        
        <div className="w-9 h-9 rounded-lg bg-navy flex items-center justify-center">
          <FileText className="w-4 h-4 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-navy">Custom Invoices</h1>
          <p className="text-xs text-muted-foreground">Create branded ATI invoices from your template</p>
        </div>
      </div>

      <CustomInvoiceForm
        key={edit ?? 'new'}
        settings={settings}
        existingInvoices={invoiceNumbers}
        savedClients={savedClients}
        paymentMethods={paymentMethods}
        services={services}
        editInvoice={editInvoice}
        sarToPkrRate={currency?.sar_to_pkr ?? 75}
      />
    </div>
  )
}

