import { cookies } from 'next/headers'
import { isDemoMode } from '@/lib/is-demo'
import { isAdminPermission, isModeratorPermission, normalizePermission } from '@/lib/permissions'
import type { StaffPermission } from '@/lib/types'

export async function requireApiUser(): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (isDemoMode()) {
    const cookieStore = await cookies()
    if (!cookieStore.get('demo_session')?.value) {
      return { ok: false, status: 401, error: 'Unauthorized' }
    }
    return { ok: true }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }
  return { ok: true }
}

export async function getApiPermission(): Promise<StaffPermission | null> {
  if (isDemoMode()) return 'Full Access'
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('staff_users').select('permission').eq('id', user.id).single()
  return normalizePermission(data?.permission)
}

export async function getApiCallerContext(): Promise<{ userId: string; permission: StaffPermission; isAdmin: boolean } | null> {
  if (isDemoMode()) return { userId: 'demo', permission: 'Full Access', isAdmin: true }
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const perm = await getApiPermission()
  if (!perm) return null
  return { userId: user.id, permission: perm, isAdmin: isAdminPermission(perm) }
}

export function canAccessDocument(permission: StaffPermission | null, createdBy: string | null | undefined, userId: string): boolean {
  if (!permission) return false
  if (isAdminPermission(permission)) return true
  if (isModeratorPermission(permission)) return createdBy === userId
  return false
}
