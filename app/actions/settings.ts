'use server'

import { revalidatePath } from 'next/cache'
import { isDemoMode } from '@/lib/is-demo'
import { demoStore } from '@/lib/demo-store'
import { friendlyDbError } from '@/lib/friendly-db-error'

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
    makkah_ziarat_rate: Number(formData.get('makkah_ziarat_rate')) || 0,
    madina_ziarat_rate: Number(formData.get('madina_ziarat_rate')) || 0,
    badr_ziarat_rate: Number(formData.get('badr_ziarat_rate')) || 0,
    taif_ziarat_rate: Number(formData.get('taif_ziarat_rate')) || 0,
  }
  if (isDemoMode()) {
    Object.assign(demoStore.visa, payload)
  } else {
    const sb = await getSupabase()
    const { data: existing } = await sb.from('visa_settings').select('id').single()
    const { error } = existing?.id
      ? await sb.from('visa_settings').update(payload).eq('id', existing.id)
      : await sb.from('visa_settings').insert(payload)
    if (error) {
      const msg = error.message ?? 'Save failed'
      if (msg.includes('badr_ziarat_rate') || msg.includes('taif_ziarat_rate') || error.code === 'PGRST204') {
        return {
          error: 'Badr/Taif columns missing in database. Run supabase/fix-011-ziarat-columns.sql in Supabase SQL Editor, then try again.',
        }
      }
      return { error: msg }
    }
  }
  revalidatePath('/settings/ziarats')
  revalidatePath('/calculator')
  revalidatePath('/umrah-poster')
  return { success: true as const }
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
  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Hotel name is required.' }
  const payload = {
    city: formData.get('city') as 'Makkah' | 'Madinah',
    name,
    location: (formData.get('location') as string) || '',
    distance: (formData.get('distance') as string) || '',
    contact_number: String(formData.get('contact_number') ?? '').trim(),
    sharing_sar: Number(formData.get('sharing_sar')),
    quad_sar: Number(formData.get('quad_sar')),
    triple_sar: Number(formData.get('triple_sar')),
    double_sar: Number(formData.get('double_sar')),
    room_sar: Number(formData.get('room_sar')),
  }
  const basePayload = {
    city: payload.city,
    name: payload.name,
    location: payload.location,
    distance: payload.distance,
    sharing_sar: payload.sharing_sar,
    quad_sar: payload.quad_sar,
    triple_sar: payload.triple_sar,
    double_sar: payload.double_sar,
  }
  const extendedPayload = {
    ...basePayload,
    contact_number: payload.contact_number,
    room_sar: payload.room_sar,
  }

  if (isDemoMode()) {
    demoStore.upsertHotel(id ? { ...payload, id } : payload)
  } else {
    const sb = await getSupabase()
    const isMissingColumn = (message: string) =>
      message.includes('contact_number') || message.includes('room_sar') || message.includes('schema cache')

    if (id) {
      let { error } = await sb.from('hotels').update(extendedPayload).eq('id', id)
      if (error && isMissingColumn(error.message)) {
        const retry = await sb.from('hotels').update(basePayload).eq('id', id)
        if (!retry.error) {
          return {
            error: 'Contact number could not be saved. Run supabase/migrations/011_client_changes.sql in Supabase SQL Editor, then try again.',
          }
        }
        error = retry.error
      }
      if (error) return { error: friendlyDbError(error.message) }
    } else {
      let { error } = await sb.from('hotels').upsert(extendedPayload, { onConflict: 'name,city' })
      if (error && isMissingColumn(error.message)) {
        const retry = await sb.from('hotels').upsert(basePayload, { onConflict: 'name,city' })
        if (!retry.error) {
          return {
            error: 'Contact number could not be saved. Run supabase/migrations/011_client_changes.sql in Supabase SQL Editor, then try again.',
          }
        }
        error = retry.error
      }
      if (error) return { error: friendlyDbError(error.message) }
    }
  }
  revalidatePath('/settings/hotels')
  revalidatePath('/hotel-voucher')
  revalidatePath('/calculator')
  return { success: true as const }
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

export async function updateFlightCities(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const { formValueToCities, DEFAULT_PK_FLIGHT_CITIES, DEFAULT_SA_FLIGHT_CITIES } = await import('@/lib/flight-cities')
  const payload = {
    pk_flight_cities: formValueToCities(String(formData.get('pk_flight_cities') ?? ''), DEFAULT_PK_FLIGHT_CITIES),
    sa_flight_cities: formValueToCities(String(formData.get('sa_flight_cities') ?? ''), DEFAULT_SA_FLIGHT_CITIES),
  }
  if (isDemoMode()) {
    Object.assign(demoStore.company, payload)
  } else {
    const sb = await getSupabase()
    const { data: existing } = await sb.from('company').select('id').single()
    if (existing?.id) await sb.from('company').update(payload).eq('id', existing.id)
    else await sb.from('company').insert(payload)
  }
  revalidatePath('/settings/flight-cities')
  revalidatePath('/calculator')
  return { success: true }
}

export async function upsertInvoiceClient(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const id = formData.get('id') as string | null
  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Client name is required.' }
  const payload = {
    name,
    address: (formData.get('address') as string) || '',
    client_number: (formData.get('client_number') as string) || '',
  }
  if (isDemoMode()) {
    demoStore.upsertInvoiceClient(id ? { ...payload, id } : payload)
  } else {
    const sb = await getSupabase()
    if (id) await sb.from('invoice_clients').update(payload).eq('id', id)
    else await sb.from('invoice_clients').insert(payload)
  }
  revalidatePath('/settings/invoices')
  revalidatePath('/custom-invoices')
  revalidatePath('/calculator')
  return { success: true }
}

export async function deleteInvoiceClient(id: string) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  if (isDemoMode()) demoStore.deleteInvoiceClient(id)
  else {
    const sb = await getSupabase()
    await sb.from('invoice_clients').delete().eq('id', id)
  }
  revalidatePath('/settings/invoices')
  revalidatePath('/custom-invoices')
  return { success: true }
}

export async function upsertInvoicePaymentMethod(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const id = formData.get('id') as string | null
  const label = (formData.get('label') as string).trim()
  if (!label) return { error: 'Label is required.' }
  const payload = {
    label,
    bank_name: (formData.get('bank_name') as string).trim(),
    account_number: (formData.get('account_number') as string).trim(),
  }
  if (isDemoMode()) {
    demoStore.upsertInvoicePaymentMethod(id ? { ...payload, id } : payload)
  } else {
    const sb = await getSupabase()
    if (id) await sb.from('invoice_payment_methods').update(payload).eq('id', id)
    else await sb.from('invoice_payment_methods').insert(payload)
  }
  revalidatePath('/settings/invoices')
  revalidatePath('/custom-invoices')
  return { success: true }
}

export async function deleteInvoicePaymentMethod(id: string) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  if (isDemoMode()) demoStore.deleteInvoicePaymentMethod(id)
  else {
    const sb = await getSupabase()
    await sb.from('invoice_payment_methods').delete().eq('id', id)
  }
  revalidatePath('/settings/invoices')
  revalidatePath('/custom-invoices')
  return { success: true }
}

export async function upsertInvoiceService(formData: FormData) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  const id = formData.get('id') as string | null
  const name = (formData.get('name') as string).trim()
  if (!name) return { error: 'Service name is required.' }
  if (isDemoMode()) {
    demoStore.upsertInvoiceService(id ? { id, name } : { name })
  } else {
    const sb = await getSupabase()
    if (id) await sb.from('invoice_services').update({ name }).eq('id', id)
    else await sb.from('invoice_services').upsert({ name }, { onConflict: 'name' })
  }
  revalidatePath('/settings/invoices')
  revalidatePath('/custom-invoices')
  return { success: true }
}

export async function deleteInvoiceService(id: string) {
  const guard = await requireSettingsAccess(); if (guard) return guard
  if (isDemoMode()) demoStore.deleteInvoiceService(id)
  else {
    const sb = await getSupabase()
    await sb.from('invoice_services').delete().eq('id', id)
  }
  revalidatePath('/settings/invoices')
  revalidatePath('/custom-invoices')
  return { success: true }
}
