'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { permissionFromRole } from '@/lib/permissions'
import { requireAdmin } from '@/lib/permissions-server'
import type { StaffRole } from '@/lib/types'

export async function createStaffUser(formData: FormData) {
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const name = (formData.get('name') as string).trim()
  const username = (formData.get('username') as string).trim()
  const role = formData.get('role') as StaffRole
  const permission = permissionFromRole(role)
  const status = (formData.get('status') as string) || 'Active'

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
  const guard = await requireAdmin()
  if ('error' in guard) return guard
  const id = formData.get('id') as string
  const role = formData.get('role') as StaffRole
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
  const guard = await requireAdmin()
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
