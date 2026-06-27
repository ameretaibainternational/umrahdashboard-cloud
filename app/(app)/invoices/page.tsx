import { getPackageInvoices, getCurrentStaff } from '@/lib/db'
import { isViewerPermission } from '@/lib/permissions'
import PackageInvoicesTable from '@/components/calculator/PackageInvoicesTable'

export default async function InvoicesPage() {
  const [invoices, staff] = await Promise.all([
    getPackageInvoices(),
    getCurrentStaff(),
  ])
  const canManage = !staff || !isViewerPermission(staff.permission)

  return <PackageInvoicesTable invoices={invoices} canManage={canManage} />
}
