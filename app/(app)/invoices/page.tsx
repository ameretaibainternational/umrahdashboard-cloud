import { Suspense } from 'react'
import { getPackageInvoices, getStandaloneCustomInvoices, getCurrentStaff, getStaff } from '@/lib/db'
import { buildStaffUsernameMap } from '@/lib/staff-lookup'
import { isViewerPermission } from '@/lib/permissions'
import InvoicesTabs from '@/components/invoices/InvoicesTabs'

export default async function InvoicesPage() {
  const [packageInvoices, customInvoices, staff, allStaff] = await Promise.all([
    getPackageInvoices(),
    getStandaloneCustomInvoices(),
    getCurrentStaff(),
    getStaff(),
  ])
  const canManage = !staff || !isViewerPermission(staff.permission)
  const staffUsernames = buildStaffUsernameMap(allStaff)

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading invoices…</div>}>
      <InvoicesTabs
        packageInvoices={packageInvoices}
        customInvoices={customInvoices}
        canManage={canManage}
        staffUsernames={staffUsernames}
      />
    </Suspense>
  )
}
