import type { StaffPermission, StaffRole } from '@/lib/types'

export const MODERATOR_ROUTE_PREFIXES = [
  '/dashboard',
  '/calculator',
  '/bookings',
  '/invoices',
  '/custom-invoices',
  '/hotel-voucher',
  '/accounts',
] as const

export const VIEWER_ROUTE_PREFIXES = ['/calculator'] as const

export function permissionFromRole(role: StaffRole): StaffPermission {
  if (role === 'Admin') return 'Full Access'
  if (role === 'Viewer') return 'View Only'
  return 'Moderator'
}

export function normalizePermission(permission: string | null | undefined): StaffPermission {
  if (permission === 'Full Access') return 'Full Access'
  if (permission === 'View Only') return 'View Only'
  return 'Moderator'
}

export function isAdminPermission(permission: string | null | undefined): boolean {
  return permission === 'Full Access'
}

export function isModeratorPermission(permission: string | null | undefined): boolean {
  return permission === 'Moderator'
}

export function isViewerPermission(permission: string | null | undefined): boolean {
  return permission === 'View Only'
}

export function getDefaultRoute(permission: string | null | undefined): string {
  if (isViewerPermission(permission)) return '/calculator'
  return '/dashboard'
}

export function canAccessRoute(permission: string | null | undefined, pathname: string): boolean {
  if (!permission) return false
  if (isAdminPermission(permission)) return true
  if (isViewerPermission(permission)) {
    return VIEWER_ROUTE_PREFIXES.some(
      prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  }
  if (!isModeratorPermission(permission)) return false
  return MODERATOR_ROUTE_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export interface CallerContext {
  userId: string
  permission: StaffPermission
  isAdmin: boolean
}

/** Returns user id to filter by, or null if caller sees all records. */
export function scopeUserId(ctx: CallerContext): string | null {
  return ctx.isAdmin ? null : ctx.userId
}
