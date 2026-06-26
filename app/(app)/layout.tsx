import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { isDemoMode } from '@/lib/is-demo'
import { getCompany, getCurrentStaff, getStorageUsage } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/layout/AppShell'
import { normalizePermission } from '@/lib/permissions'
import type { StaffPermission } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (isDemoMode()) {
    const cookieStore = await cookies()
    const demoSession = cookieStore.get('demo_session')?.value
    if (!demoSession) redirect('/login')
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
  }

  const [company, staff, storageUsage] = await Promise.all([
    getCompany(),
    getCurrentStaff(),
    getStorageUsage(),
  ])
  if (!staff) redirect('/login')
  const permission: StaffPermission = normalizePermission(staff.permission)

  return (
    <AppShell
      companyName={company.name}
      isDemo={isDemoMode()}
      permission={permission}
      storageTotalBytes={storageUsage.total_bytes}
    >
      {children}
    </AppShell>
  )
}
