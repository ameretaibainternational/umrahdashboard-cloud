import { createClient } from '@/lib/supabase/server'
import type { CustomInvoiceLineItem, PackageInvoiceData } from '@/lib/types'
import { encodePackageDataInTerms } from '@/lib/package-invoice'

function isCreatedBySchemaError(message: string): boolean {
  return message.includes('created_by') || message.includes('schema cache')
}

function isPackageColumnError(message: string): boolean {
  return message.includes('invoice_kind') || message.includes('package_data') || message.includes('schema cache')
}

type PackageInvoiceRow = {
  id: string
  invoice_number: string
  invoice_date: string
  billed_to_name: string
  total: number
  received: number
  remaining: number
  storage_key: string
  file_size_bytes: number
  package_data: PackageInvoiceData
  contact_phone?: string
  contact_email?: string
  contact_location?: string
  created_by?: string | null
}

export async function insertCustomInvoiceSupabase(row: {
  id: string
  invoice_date: string
  billed_to_name: string
  billed_to_address: string
  billed_to_client_number: string
  payment_bank_name: string
  payment_account_number: string
  terms_text: string
  contact_phone: string
  contact_email: string
  contact_location: string
  line_items: CustomInvoiceLineItem[]
  total: number
  received: number
  remaining: number
  storage_key: string
  file_size_bytes: number
  created_by?: string | null
}): Promise<{ id: string; invoice_number: string }> {
  const supabase = await createClient()
  const payload = {
    id: row.id,
    invoice_date: row.invoice_date,
    billed_to_name: row.billed_to_name,
    billed_to_address: row.billed_to_address,
    billed_to_client_number: row.billed_to_client_number,
    payment_bank_name: row.payment_bank_name,
    payment_account_number: row.payment_account_number,
    terms_text: row.terms_text,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    contact_location: row.contact_location,
    line_items: row.line_items,
    total: row.total,
    received: row.received,
    remaining: row.remaining,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
    created_by: row.created_by ?? null,
  }

  let result = await supabase.from('custom_invoices').insert(payload).select('id, invoice_number').single()
  if (result.error && isCreatedBySchemaError(result.error.message)) {
    const { created_by: _, ...withoutOwner } = payload
    result = await supabase.from('custom_invoices').insert(withoutOwner).select('id, invoice_number').single()
  }
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function insertPackageInvoiceSupabase(row: PackageInvoiceRow): Promise<{ id: string; invoice_number: string }> {
  const supabase = await createClient()
  const base = {
    id: row.id,
    invoice_number: row.invoice_number,
    invoice_date: row.invoice_date,
    billed_to_name: row.billed_to_name,
    billed_to_address: '',
    billed_to_client_number: '',
    payment_bank_name: '',
    payment_account_number: '',
    contact_phone: row.contact_phone ?? '',
    contact_email: row.contact_email ?? '',
    contact_location: row.contact_location ?? '',
    line_items: [] as CustomInvoiceLineItem[],
    total: row.total,
    received: row.received,
    remaining: row.remaining,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
    created_by: row.created_by ?? null,
  }

  const attempts: Record<string, unknown>[] = [
    { ...base, terms_text: '', invoice_kind: 'package', package_data: row.package_data },
    { ...base, terms_text: encodePackageDataInTerms(row.package_data) },
    { ...base, terms_text: encodePackageDataInTerms(row.package_data), created_by: undefined },
  ]

  let lastError = 'Insert failed'
  for (const attempt of attempts) {
    const payload = Object.fromEntries(Object.entries(attempt).filter(([, v]) => v !== undefined))
    const result = await supabase.from('custom_invoices').insert(payload).select('id, invoice_number').single()
    if (!result.error) return result.data
    lastError = result.error.message
    if (!isPackageColumnError(lastError) && !isCreatedBySchemaError(lastError)) break
  }
  throw new Error(lastError)
}

export async function updatePackageInvoiceSupabase(row: PackageInvoiceRow): Promise<{ id: string; invoice_number: string }> {
  const supabase = await createClient()
  const base = {
    invoice_date: row.invoice_date,
    billed_to_name: row.billed_to_name,
    contact_phone: row.contact_phone ?? '',
    contact_email: row.contact_email ?? '',
    contact_location: row.contact_location ?? '',
    total: row.total,
    received: row.received,
    remaining: row.remaining,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
  }

  const attempts: Record<string, unknown>[] = [
    { ...base, terms_text: '', invoice_kind: 'package', package_data: row.package_data },
    { ...base, terms_text: encodePackageDataInTerms(row.package_data) },
  ]

  let lastError = 'Update failed'
  for (const attempt of attempts) {
    const payload = Object.fromEntries(Object.entries(attempt).filter(([, v]) => v !== undefined))
    const { error } = await supabase.from('custom_invoices').update(payload).eq('id', row.id)
    if (!error) return { id: row.id, invoice_number: row.invoice_number }
    lastError = error.message
    if (!isPackageColumnError(lastError)) break
  }
  throw new Error(lastError)
}

export async function insertHotelVoucherSupabase(row: {
  id: string
  voucher_date: string
  reference_no: string
  family_head: string
  package_info: string
  voucher_data: Record<string, unknown>
  storage_key: string
  file_size_bytes: number
  created_by?: string | null
}): Promise<{ id: string; voucher_number: string }> {
  const supabase = await createClient()
  const payload = {
    id: row.id,
    voucher_date: row.voucher_date,
    reference_no: row.reference_no,
    family_head: row.family_head,
    package_info: row.package_info,
    voucher_data: row.voucher_data,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
    created_by: row.created_by ?? null,
  }

  let result = await supabase.from('hotel_vouchers').insert(payload).select('id, voucher_number').single()
  if (result.error && isCreatedBySchemaError(result.error.message)) {
    const { created_by: _, ...withoutOwner } = payload
    result = await supabase.from('hotel_vouchers').insert(withoutOwner).select('id, voucher_number').single()
  }
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function fetchFileForDownloadSupabase(id: string, type: 'invoice' | 'voucher') {
  const supabase = await createClient()
  if (type === 'invoice') {
    let { data, error } = await supabase
      .from('custom_invoices')
      .select('storage_key, file_deleted_at, invoice_number, created_by')
      .eq('id', id)
      .single()
    if (error && isCreatedBySchemaError(error.message)) {
      ({ data, error } = await supabase
        .from('custom_invoices')
        .select('storage_key, file_deleted_at, invoice_number')
        .eq('id', id)
        .single())
    }
    if (error || !data) return null
    return {
      storage_key: data.storage_key,
      file_deleted_at: data.file_deleted_at,
      created_by: 'created_by' in data ? data.created_by : null,
      number: data.invoice_number,
    }
  }

  let { data, error } = await supabase
    .from('hotel_vouchers')
    .select('storage_key, file_deleted_at, voucher_number, created_by')
    .eq('id', id)
    .single()
  if (error && isCreatedBySchemaError(error.message)) {
    ({ data, error } = await supabase
      .from('hotel_vouchers')
      .select('storage_key, file_deleted_at, voucher_number')
      .eq('id', id)
      .single())
  }
  if (error || !data) return null
  return {
    storage_key: data.storage_key,
    file_deleted_at: data.file_deleted_at,
    created_by: 'created_by' in data ? data.created_by : null,
    number: data.voucher_number,
  }
}

export async function fetchFileForBulkDownloadSupabase(id: string, type: 'invoice' | 'voucher') {
  const row = await fetchFileForDownloadSupabase(id, type)
  if (!row?.storage_key || row.file_deleted_at) return null
  return { name: `${row.number}.pdf`, storage_key: row.storage_key }
}

export async function softDeleteFileRowSupabase(id: string, type: 'invoice' | 'voucher') {
  const supabase = await createClient()
  const table = type === 'invoice' ? 'custom_invoices' : 'hotel_vouchers'
  const { data } = await supabase.from(table).select('storage_key, file_deleted_at').eq('id', id).single()
  return data ?? undefined
}

export async function markFileDeletedSupabase(id: string, type: 'invoice' | 'voucher', deletedAt: string) {
  const supabase = await createClient()
  const table = type === 'invoice' ? 'custom_invoices' : 'hotel_vouchers'
  await supabase.from(table).update({ file_deleted_at: deletedAt }).eq('id', id)
}
