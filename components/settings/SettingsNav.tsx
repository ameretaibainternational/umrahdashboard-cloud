'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/settings/visa',      label: 'Visa' },
  { href: '/settings/tickets',   label: 'Airlines' },
  { href: '/settings/transport', label: 'Transport' },
  { href: '/settings/hotels',    label: 'Hotels' },
  { href: '/settings/hotel-contacts', label: 'Hotel Contacts' },
  { href: '/settings/transport-contacts', label: 'Transport Contacts' },
  { href: '/settings/ziarats',   label: 'Ziarats' },
  { href: '/settings/flight-cities', label: 'Flight Cities' },
  { href: '/settings/currency',  label: 'Currency' },
  { href: '/settings/company',   label: 'Company' },
  { href: '/settings/invoices',  label: 'Invoices' },
  { href: '/settings/storage',   label: 'Storage' },
]

export default function SettingsNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 mb-6 bg-muted/40 p-1 rounded-lg w-fit flex-wrap">
      {tabs.map(t => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
            pathname === t.href
              ? 'bg-white shadow-sm text-navy font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
