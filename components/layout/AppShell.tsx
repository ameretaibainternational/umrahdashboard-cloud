'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import NavigationProgress from './NavigationProgress'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calculator': 'Umrah Calculator',
  '/bookings': 'Bookings',
  '/customers': 'Customers',
  '/invoices': 'Invoices',
  '/accounts': 'Accounts',
  '/reports': 'Reports',
  '/users': 'Users & Staff',
}

interface AppShellProps {
  children: React.ReactNode
  companyName: string
  isDemo?: boolean
}

export default function AppShell({ children, companyName, isDemo }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const pathname = usePathname()

  // Restore collapsed state from localStorage after hydration
  useEffect(() => {
    try {
      if (localStorage.getItem('ft_sidebar_collapsed') === '1') {
        setSidebarCollapsed(true)
      }
    } catch { /* localStorage unavailable */ }
  }, [])

  function handleToggleCollapse() {
    setSidebarCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('ft_sidebar_collapsed', next ? '1' : '0') } catch { /* ignore */ }
      return next
    })
  }

  const title = pathname.startsWith('/settings')
    ? 'Settings'
    : pageTitles[pathname] ?? 'Fast Travels CRM'

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <NavigationProgress />
      <Sidebar
        companyName={companyName}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[272px]'
        )}
      >
        {isDemo && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              Demo Mode — data is in-memory only and resets on server restart.
              Add your Supabase credentials to <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code> to use a real database.
            </p>
          </div>
        )}
        <Topbar
          title={title}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
