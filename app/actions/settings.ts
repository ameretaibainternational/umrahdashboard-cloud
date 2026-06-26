'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'

async function getSupabase() {
  const { createClient } = await import('@/lib/supabase/server')
  return createClient()
}

async function requireSettingsAccess() {
  const { requireAdmin } = await import('@/lib/permissions-server')
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx
  return null
}

async function requireFullAccess() {
  const { requireAdmin } = await import('@/lib/permissions-server')
  const ctx = await requireAdmin()
  if ('error' in ctx) return ctx
  return null
}

export async function updateVisa(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const payload = {
    visa_rate_1_pax:    Number(formData.get('visa_rate_1_pax')),
    visa_rate_2_pax:    Number(formData.get('visa_rate_2_pax')),
    visa_rate_3_pax:    Number(formData.get('visa_rate_3_pax')),
    visa_rate_4_pax:    Number(formData.get('visa_rate_4_pax')),
    visa_rate_group_pax: Number(formData.get('visa_rate_group_pax')),
    child_sar:          Number(formData.get('child_sar')),
    infant_sar:         Number(formData.get('infant_sar')),
    transport_mode:     formData.get('transport_mode') as 'included' | 'separate',
  }
  if (isDemoMode()) {
    Object.assign(demoStore.visa, payload)
  } else {
    const sb = await getSupabase()
    const { data: existing } = await sb.from('visa_settings').select('id').single()
    if (existing?.id) await sb.from('visa_settings').update(payload).eq('id', existing.id)
    else await sb.from('visa_settings').insert(payload)
  }
  revalidatePath('/settings/visa')
  return { success: true }
}

export async function updateZiarats(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const payload = {
    makkah_ziarat_rate: Number(formData.get('makkah_ziarat_rate')),
    madina_ziarat_rate: Number(formData.get('madina_ziarat_rate')),
  }
  if (isDemoMode()) {
    Object.assign(demoStore.visa, payload)
  } else {
    const sb = await getSupabase()
    const { data: existing } = await sb.from('visa_settings').select('id').single()
    if (existing?.id) await sb.from('visa_settings').update(payload).eq('id', existing.id)
    else await sb.from('visa_settings').insert(payload)
  }
  revalidatePath('/settings/ziarats')
  return { success: true }
}

export async function updateCurrency(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const payload = { sar_to_pkr: Number(formData.get('sar_to_pkr')) }
  if (isDemoMode()) {
    Object.assign(demoStore.currency, payload)
  } else {
    const sb = await getSupabase()
    const { data: existing } = await sb.from('currency_settings').select('id').single()
    if (existing?.id) await sb.from('currency_settings').update(payload).eq('id', existing.id)
    else await sb.from('currency_settings').insert(payload)
  }
  revalidatePath('/settings/currency')
  return { success: true }
}

export async function updateTransport(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  if (isDemoMode()) {
    for (const type of ['bus', 'private'] as const) {
      for (let pax = 1; pax <= 4; pax++) {
        const rate = demoStore.transportRates.find(r => r.type === type && r.pax_count === pax)
        if (rate) rate.rate_sar = Number(formData.get(`${type}_${pax}`))
      }
    }
  } else {
    const sb = await getSupabase()
    for (const type of ['bus', 'private']) {
      for (let pax = 1; pax <= 4; pax++) {
        await sb.from('transport_rates').upsert(
          { type, pax_count: pax, rate_sar: Number(formData.get(`${type}_${pax}`)) },
          { onConflict: 'type,pax_count' }
        )
      }
    }
  }
  revalidatePath('/settings/transport')
  return { success: true }
}

export async function upsertAirline(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const id = formData.get('id') as string | null
  const payload = {
    name: (formData.get('name') as string).trim(),
    adult_pkr: Number(formData.get('adult_pkr')),
    child_pkr: Number(formData.get('child_pkr')),
    infant_pkr: Number(formData.get('infant_pkr')),
  }
  if (isDemoMode()) {
    demoStore.upsertAirline(id ? { ...payload, id } : payload)
  } else {
    const sb = await getSupabase()
    if (id) await sb.from('airlines').update(payload).eq('id', id)
    else await sb.from('airlines').upsert(payload, { onConflict: 'name' })
  }
  revalidatePath('/settings/tickets')
  return { success: true }
}

export async function deleteAirline(id: string) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  if (isDemoMode()) demoStore.deleteAirline(id)
  else {
    const sb = await getSupabase()
    await sb.from('airlines').delete().eq('id', id)
  }
  revalidatePath('/settings/tickets')
  return { success: true }
}

export async function upsertHotel(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const id = formData.get('id') as string | null
  const payload = {
    city: formData.get('city') as 'Makkah' | 'Madinah',
    name: (formData.get('name') as string).trim(),
    location: (formData.get('location') as string) || '',
    distance: (formData.get('distance') as string) || '',
    sharing_sar: Number(formData.get('sharing_sar')),
    quad_sar: Number(formData.get('quad_sar')),
    triple_sar: Number(formData.get('triple_sar')),
    double_sar: Number(formData.get('double_sar')),
  }
  if (isDemoMode()) {
    demoStore.upsertHotel(id ? { ...payload, id } : payload)
  } else {
    const sb = await getSupabase()
    if (id) await sb.from('hotels').update(payload).eq('id', id)
    else await sb.from('hotels').upsert(payload, { onConflict: 'name,city' })
  }
  revalidatePath('/settings/hotels')
  return { success: true }
}

export async function deleteHotel(id: string) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  if (isDemoMode()) demoStore.deleteHotel(id)
  else {
    const sb = await getSupabase()
    await sb.from('hotels').delete().eq('id', id)
  }
  revalidatePath('/settings/hotels')
  return { success: true }
}

export async function updateCompany(formData: FormData) {
  const guard = await requireFullAccess(); if (guard) return guard
  const payload = {
    name: (formData.get('name') as string).trim(),
    license: (formData.get('license') as string) || '',
    phone: (formData.get('phone') as string) || '',
    website: (formData.get('website') as string) || '',
    address: (formData.get('address') as string) || '',
  }
  if (isDemoMode()) {
    Object.assign(demoStore.company, payload)
  } else {
    const sb = await getSupabase()
    const { data: existing } = await sb.from('company').select('id').single()
    if (existing?.id) await sb.from('company').update(payload).eq('id', existing.id)
    else await sb.from('company').insert(payload)
  }
  revalidatePath('/settings/company')
  return { success: true }
}
