'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import PackageInvoicesTable from '@/components/calculator/PackageInvoicesTable'
import CustomInvoicesTable from '@/components/invoices/CustomInvoicesTable'
import type { CustomInvoice } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Props {
  packageInvoices: CustomInvoice[]
  customInvoices: CustomInvoice[]
  canManage: boolean
}

export default function InvoicesTabs({ packageInvoices, customInvoices, canManage }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') === 'custom' ? 'custom' : 'package'

  function setTab(next: 'package' | 'custom') {
    router.replace(next === 'custom' ? '/invoices?tab=custom' : '/invoices')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Invoices</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Package calculator invoices and standalone custom invoices
        </p>
      </div>

      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('package')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            tab === 'package'
              ? 'bg-white text-navy shadow-sm'
              : 'text-muted-foreground hover:text-navy',
          )}
        >
          Package Invoices
        </button>
        <button
          type="button"
          onClick={() => setTab('custom')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-colors',
            tab === 'custom'
              ? 'bg-white text-navy shadow-sm'
              : 'text-muted-foreground hover:text-navy',
          )}
        >
          Custom Invoices
        </button>
      </div>

      {tab === 'package'
        ? <PackageInvoicesTable invoices={packageInvoices} canManage={canManage} />
        : <CustomInvoicesTable invoices={customInvoices} canManage={canManage} />}
    </div>
  )
}
