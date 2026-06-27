'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calculator, BookOpen, FileText,
  Wallet, Settings, UserCog, LogOut, X,
  PanelLeftClose, PanelLeftOpen, Receipt, BedDouble, ImageIcon,
} from 'lucide-react'
import { logout } from '@/app/actions/auth'
import { cn } from '@/lib/utils'
import { isAdminPermission, isViewerPermission } from '@/lib/permissions'
import type { StaffPermission } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/dashboard',       label: 'Dashboard',       icon: LayoutDashboard, adminOnly: false, moderator: true, viewer: false },
  { href: '/calculator',      label: 'Umrah Calculator', icon: Calculator, adminOnly: false, moderator: true, viewer: true },
  { href: '/bookings',        label: 'Bookings',         icon: BookOpen, adminOnly: false, moderator: true, viewer: false },
  { href: '/invoices',        label: 'Invoices',         icon: FileText, adminOnly: false, moderator: true, viewer: false },
  { href: '/custom-invoices', label: 'Custom Invoices',  icon: Receipt, adminOnly: false, moderator: true, viewer: false },
  { href: '/hotel-voucher',   label: 'Hotel Voucher',    icon: BedDouble, adminOnly: false, moderator: true, viewer: false },
  { href: '/umrah-poster',    label: 'Umrah Poster',     icon: ImageIcon, adminOnly: false, moderator: true, viewer: false },
  { href: '/accounts',        label: 'Accounts',         icon: Wallet, adminOnly: false, moderator: true, viewer: false },
  { href: '/settings/visa',   label: 'Settings',         icon: Settings, adminOnly: true, moderator: false, viewer: false },
  { href: '/users',           label: 'Users & Staff',    icon: UserCog, adminOnly: true, moderator: false, viewer: false },
] as const

interface SidebarProps {
  companyName: string
  open: boolean
  onClose: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  permission: StaffPermission
}

export default function Sidebar({ companyName, open, onClose, collapsed, onToggleCollapse, permission }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = isAdminPermission(permission)
  const isViewer = isViewerPermission(permission)

  const isActive = (href: string) => {
    if (href === '/settings/visa') return pathname.startsWith('/settings')
    return pathname === href
  }

  const visibleItems = NAV_ITEMS.filter(item => {
    if (isAdmin) return true
    if (isViewer) return item.viewer
    return item.moderator
  })

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full z-50 flex flex-col',
          'bg-navy text-white transition-all duration-300',
          'lg:translate-x-0 lg:z-10',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[272px] lg:w-[72px]' : 'w-[272px]',
        )}
      >
        <div className={cn(
          'flex items-center border-b border-white/10 flex-shrink-0 gap-3 px-4 py-4',
          collapsed && 'lg:flex-col lg:gap-2 lg:px-2',
        )}>
          <div className="w-16 h-16 rounded-xl bg-transparent flex items-center justify-center flex-shrink-0">
            <img src="/logo.png" alt="Amere Taiba International" className="w-full h-full object-contain" />
          </div>

          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <p className="text-sm font-bold truncate leading-tight">Amere Taiba</p>
            <p className="text-[11px] text-white/50 leading-tight">International</p>
          </div>

          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'hidden lg:flex items-center justify-center rounded-lg transition-colors',
              'text-white/50 hover:text-white hover:bg-white/10',
              collapsed ? 'w-8 h-8' : 'w-8 h-8 ml-auto flex-shrink-0'
            )}
          >
            {collapsed
              ? <PanelLeftOpen className="w-4 h-4" />
              : <PanelLeftClose className="w-4 h-4" />
            }
          </button>

          <button
            className="lg:hidden text-white/60 hover:text-white ml-auto"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className={cn(
          'flex-1 overflow-y-auto py-3 space-y-0.5 sidebar-scroll px-3',
          collapsed && 'lg:px-1.5',
        )}>
          {visibleItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-all duration-150 gap-3 px-3 py-2.5',
                collapsed && 'lg:justify-center lg:px-0 lg:gap-0',
                isActive(href)
                  ? 'bg-gold-gradient text-navy font-semibold'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className={cn(collapsed && 'lg:hidden')}>{label}</span>
            </Link>
          ))}
        </nav>

        <div className={cn('py-3 border-t border-white/10 px-3', collapsed && 'lg:px-1.5')}>
          <form action={logout}>
            <button
              type="submit"
              title={collapsed ? 'Sign Out' : undefined}
              className={cn(
                'w-full flex items-center rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all gap-3 px-3 py-2.5',
                collapsed && 'lg:justify-center lg:px-0 lg:gap-0',
              )}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className={cn(collapsed && 'lg:hidden')}>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
