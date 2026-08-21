'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { permissionFromRole } from '@/lib/permissions'
import { requireSuperAdmin, getCallerContext } from '@/lib/permissions-server'
import type { StaffRole } from '@/lib/types'

async function countSuperAdmins(excludeId?: string): Promise<number> {
  if (isDemoMode()) {
    return demoStore.staff.filter(
      s => s.permission === 'Super Admin' && s.status === 'Active' && s.id !== excludeId,
    ).length
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  let q = supabase
    .from('staff_users')
    .select('id', { count: 'exact', head: true })
    .eq('permission', 'Super Admin')
    .eq('status', 'Active')
  if (excludeId) q = q.neq('id', excludeId)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function validateSuperAdminAssignment(
  role: StaffRole,
  editingId?: string,
): Promise<{ error: string } | null> {
  if (role !== 'Super Admin') return null

  const ctx = await getCallerContext()
  if ('error' in ctx) return ctx
  if (!ctx.isSuperAdmin) {
    return { error: 'Only the Super Admin can assign the Super Admin role.' }
  }

  const existing = await countSuperAdmins(editingId)
  if (existing > 0) {
    return { error: 'There can only be one Super Admin account.' }
  }

  return null
}

export async function createStaffUser(formData: FormData) {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard
  const name = (formData.get('name') as string).trim()
  const username = (formData.get('username') as string).trim()
  const role = formData.get('role') as StaffRole
  const permission = permissionFromRole(role)
  const status = (formData.get('status') as string) || 'Active'

  const superAdminError = await validateSuperAdminAssignment(role)
  if (superAdminError) return superAdminError

  if (isDemoMode()) {
    demoStore.addStaff({ name, username, role, permission, status: status as 'Active' | 'Inactive' })
    revalidatePath('/users')
    return { success: true }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { createServiceClient } = await import('@/lib/supabase/server')
  const serviceClient = await createServiceClient()

  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (authError) return { error: authError.message }

  const { error: profileError } = await serviceClient.from('staff_users').insert({
    id: authData.user.id, name, username, role, permission, status,
  })
  if (profileError) {
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return { error: profileError.message }
  }

  revalidatePath('/users')
  return { success: true }
}

export async function updateStaffUser(formData: FormData) {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard
  const id = formData.get('id') as string
  const role = formData.get('role') as StaffRole

  const superAdminError = await validateSuperAdminAssignment(role, id)
  if (superAdminError) return superAdminError

  const payload = {
    name: (formData.get('name') as string).trim(),
    username: (formData.get('username') as string).trim(),
    role,
    permission: permissionFromRole(role),
    status: formData.get('status') as 'Active' | 'Inactive',
  }

  if (isDemoMode()) {
    demoStore.updateStaff(id, payload)
    revalidatePath('/users')
    return { success: true }
  }

  const { createClient, createServiceClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const serviceClient = await createServiceClient()

  await supabase.from('staff_users').update(payload).eq('id', id)

  const email = formData.get('email') as string
  if (email) await serviceClient.auth.admin.updateUserById(id, { email })

  const password = formData.get('password') as string
  if (password) await serviceClient.auth.admin.updateUserById(id, { password })

  revalidatePath('/users')
  return { success: true }
}

export async function deleteStaffUser(id: string) {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard
  if (isDemoMode()) {
    demoStore.deleteStaff(id)
  } else {
    const { createServiceClient } = await import('@/lib/supabase/server')
    const serviceClient = await createServiceClient()
    await serviceClient.auth.admin.deleteUser(id)
  }
  revalidatePath('/users')
  return { success: true }
}
