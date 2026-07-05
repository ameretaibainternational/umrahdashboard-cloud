import { getInvoiceSettings, getAllInvoiceNumbers, getInvoiceClients, getInvoicePaymentMethods, getInvoiceServices, getCustomInvoiceById } from '@/lib/db'
import CustomInvoiceForm from '@/components/custom-invoice/CustomInvoiceForm'
import { FileText, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function CustomInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const { edit } = await searchParams
  const [settings, invoiceNumbers, savedClients, paymentMethods, services, editInvoice] = await Promise.all([
    getInvoiceSettings(),
    getAllInvoiceNumbers(),
    getInvoiceClients(),
    getInvoicePaymentMethods(),
    getInvoiceServices(),
    edit ? getCustomInvoiceById(edit) : Promise.resolve(null),
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
      />
    </div>
  )
}
