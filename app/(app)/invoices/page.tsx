import { Suspense } from 'react'
import { getPackageInvoices, getStandaloneCustomInvoices, getCurrentStaff } from '@/lib/db'
import { isViewerPermission } from '@/lib/permissions'
import InvoicesTabs from '@/components/invoices/InvoicesTabs'

export default async function InvoicesPage() {
  const [packageInvoices, customInvoices, staff] = await Promise.all([
    getPackageInvoices(),
    getStandaloneCustomInvoices(),
    getCurrentStaff(),
  ])
  const canManage = !staff || !isViewerPermission(staff.permission)

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading invoices…</div>}>
      <InvoicesTabs
        packageInvoices={packageInvoices}
        customInvoices={customInvoices}
        canManage={canManage}
      />
    </Suspense>
  )
}
