import { redirect } from 'next/navigation'
import { getStaff, getCurrentStaff, getStaffActivityStats } from '@/lib/db'
import { isSuperAdminPermission } from '@/lib/permissions'
import StaffForm from '@/components/users/StaffForm'

export default async function UsersPage() {
  const current = await getCurrentStaff()
  if (!current || !isSuperAdminPermission(current.permission)) redirect('/dashboard')

  const [staff, activityStats] = await Promise.all([
    getStaff(),
    getStaffActivityStats(),
  ])

  return (
    <StaffForm
      staff={staff}
      activityStats={activityStats}
      isSuperAdmin
    />
  )
}
