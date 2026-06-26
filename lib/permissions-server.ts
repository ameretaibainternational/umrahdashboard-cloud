import { isDemoMode } from '@/lib/is-demo'
import {
  isAdminPermission,
  isModeratorPermission,
  isViewerPermission,
  normalizePermission,
  type CallerContext,
} from '@/lib/permissions'
import type { StaffPermission } from '@/lib/types'

export type { CallerContext } from '@/lib/permissions'

export async function getCallerContext(): Promise<CallerContext | { error: string }> {
  if (isDemoMode()) {
    return { userId: 'demo', permission: 'Full Access', isAdmin: true }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data } = await supabase.from('staff_users').select('permission').eq('id', user.id).single()
  const permission = normalizePermission(data?.permission)

  return {
    userId: user.id,
    permission,
    isAdmin: isAdminPermission(permission),
  }
}

export async function requireAdmin(): Promise<CallerContext | { error: string }> {
  const ctx = await getCallerContext()
  if ('error' in ctx) return ctx
  if (!ctx.isAdmin) return { error: 'Only admins can perform this action.' }
  return ctx
}

export async function requireModeratorFeature(
  feature: 'bookings' | 'accounts' | 'custom_invoices' | 'hotel_vouchers' | 'calculator',
): Promise<CallerContext | { error: string }> {
  const ctx = await getCallerContext()
  if ('error' in ctx) return ctx
  if (ctx.isAdmin) return ctx
  if (isViewerPermission(ctx.permission)) {
    return { error: 'You do not have permission for this action.' }
  }

  const moderatorAllowed: Record<typeof feature, boolean> = {
    bookings: true,
    accounts: true,
    custom_invoices: true,
    hotel_vouchers: true,
    calculator: true,
  }
  if (!moderatorAllowed[feature] || !isModeratorPermission(ctx.permission)) {
    return { error: 'You do not have permission for this action.' }
  }
  return ctx
}
