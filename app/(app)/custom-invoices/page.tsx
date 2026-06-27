import { getInvoiceSettings, getCustomInvoices, getInvoiceClients } from '@/lib/db'
import CustomInvoiceForm from '@/components/custom-invoice/CustomInvoiceForm'
import { FileText } from 'lucide-react'

export default async function CustomInvoicesPage() {
  const [settings, invoices, savedClients] = await Promise.all([
    getInvoiceSettings(),
    getCustomInvoices(),
    getInvoiceClients(),
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

      <CustomInvoiceForm settings={settings} existingInvoices={invoices} savedClients={savedClients} />
    </div>
  )
}
