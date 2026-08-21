import { createClient } from '@/lib/supabase/server'
import type { CustomInvoice, CustomInvoiceLineItem, PackageInvoiceData, StoredFileRow, StoredFileType, StorageUsage } from '@/lib/types'
import { storedFileEditHref } from '@/lib/stored-file-links'
import { encodePackageDataInTerms } from '@/lib/package-invoice'
import { storageUsageFromFiles } from '@/lib/storage-usage'

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
  billed_to_address?: string
  billed_to_client_number?: string
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
  invoice_title_text?: string
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
  profit_pkr?: number
  storage_key: string
  file_size_bytes: number
  created_by?: string | null
  invoice_number?: string
  invoice_title_text?: string
  package_data?: any
}): Promise<{ id: string; invoice_number: string }> {
  const supabase = await createClient()
  const payload = {
    id: row.id,
    invoice_number: row.invoice_number,
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
    profit_pkr: row.profit_pkr ?? 0,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
    invoice_title_text: row.invoice_title_text ?? 'INVOICE',
    created_by: row.created_by ?? null,
    package_data: row.package_data ?? null,
    invoice_kind: 'custom' as const,
  }

  let result = await supabase.from('custom_invoices').insert(payload).select('id, invoice_number').single()
  if (result.error && isPackageColumnError(result.error.message)) {
    const { invoice_kind: _, ...withoutKind } = payload
    result = await supabase.from('custom_invoices').insert(withoutKind).select('id, invoice_number').single()
  }
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
    billed_to_address: row.billed_to_address ?? '',
    billed_to_client_number: row.billed_to_client_number ?? '',
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
    invoice_title_text: row.invoice_title_text ?? 'INVOICE',
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
    billed_to_address: row.billed_to_address ?? '',
    billed_to_client_number: row.billed_to_client_number ?? '',
    contact_phone: row.contact_phone ?? '',
    contact_email: row.contact_email ?? '',
    contact_location: row.contact_location ?? '',
    total: row.total,
    received: row.received,
    remaining: row.remaining,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
    invoice_number: row.invoice_number,
    invoice_title_text: row.invoice_title_text ?? 'INVOICE',
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

export async function updateCustomInvoiceSupabase(row: {
  id: string
  invoice_number: string
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
  invoice_title_text?: string
  profit_pkr?: number
  package_data?: any
}): Promise<{ id: string; invoice_number: string }> {
  const supabase = await createClient()
  const payload = {
    invoice_number: row.invoice_number,
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
    invoice_title_text: row.invoice_title_text ?? 'INVOICE',
    profit_pkr: row.profit_pkr ?? 0,
    package_data: row.package_data ?? null,
    invoice_kind: 'custom' as const,
  }
  let { error } = await supabase.from('custom_invoices').update(payload).eq('id', row.id)
  if (error && isPackageColumnError(error.message)) {
    const { invoice_kind: _, ...withoutKind } = payload
    ;({ error } = await supabase.from('custom_invoices').update(withoutKind).eq('id', row.id))
  }
  if (error) throw new Error(error.message)
  return { id: row.id, invoice_number: row.invoice_number }
}

export async function fetchCustomInvoiceByIdSupabase(id: string, createdBy?: string | null): Promise<CustomInvoice | null> {
  const supabase = await createClient()
  const { isPackageInvoice } = await import('@/lib/package-invoice')
  const { mapCustomInvoiceRow } = await import('@/lib/document-db')

  let query = supabase.from('custom_invoices').select('*').eq('id', id)
  if (createdBy) query = query.eq('created_by', createdBy)

  let { data, error } = await query.maybeSingle()
  if (error && createdBy && isCreatedBySchemaError(error.message)) {
    ({ data, error } = await supabase.from('custom_invoices').select('*').eq('id', id).maybeSingle())
  }
  if (error || !data) return null
  if (createdBy && 'created_by' in data && data.created_by && data.created_by !== createdBy) return null

  const mapped = mapCustomInvoiceRow(data as Record<string, unknown>)
  return isPackageInvoice(mapped) ? null : mapped
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

export async function fetchFileForDownloadSupabase(id: string, type: StoredFileType) {
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

  if (type === 'voucher') {
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

  let { data, error } = await supabase
    .from('umrah_posters')
    .select('storage_key, file_deleted_at, poster_number, created_by')
    .eq('id', id)
    .single()
  if (error && isCreatedBySchemaError(error.message)) {
    ({ data, error } = await supabase
      .from('umrah_posters')
      .select('storage_key, file_deleted_at, poster_number')
      .eq('id', id)
      .single())
  }
  if (error || !data) return null
  return {
    storage_key: data.storage_key,
    file_deleted_at: data.file_deleted_at,
    created_by: 'created_by' in data ? data.created_by : null,
    number: data.poster_number,
  }
}

export async function fetchFileForBulkDownloadSupabase(id: string, type: StoredFileType) {
  const row = await fetchFileForDownloadSupabase(id, type)
  if (!row?.storage_key || row.file_deleted_at) return null
  const ext = type === 'poster' ? 'jpg' : 'pdf'
  return { name: `${row.number}.${ext}`, storage_key: row.storage_key }
}

export async function softDeleteFileRowSupabase(id: string, type: StoredFileType) {
  const supabase = await createClient()
  const table = type === 'invoice' ? 'custom_invoices' : type === 'voucher' ? 'hotel_vouchers' : 'umrah_posters'
  const { data } = await supabase.from(table).select('storage_key, file_deleted_at').eq('id', id).single()
  return data ?? undefined
}

export async function markFileDeletedSupabase(id: string, type: StoredFileType, deletedAt: string) {
  const supabase = await createClient()
  const table = type === 'invoice' ? 'custom_invoices' : type === 'voucher' ? 'hotel_vouchers' : 'umrah_posters'
  await supabase.from(table).update({ file_deleted_at: deletedAt }).eq('id', id)
}

type StoredFileDbRow = {
  id: string
  number: string
  label: string
  date: string
  file_size_bytes: number
  created_at: string
  storage_key: string | null
  file_deleted_at: string | null
  created_by?: string | null
  invoice_kind?: 'custom' | 'package' | null
}

function mapStoredInvoiceRows(rows: StoredFileDbRow[]): StoredFileRow[] {
  return rows
    .filter(r => r.storage_key && !r.file_deleted_at && r.file_size_bytes)
    .map(r => ({
      id: r.id,
      type: 'invoice' as const,
      number: r.number,
      label: r.label ?? '',
      date: String(r.date).slice(0, 10),
      file_size_bytes: Number(r.file_size_bytes),
      created_at: r.created_at,
      edit_href: storedFileEditHref('invoice', r.id, r.invoice_kind ?? 'custom'),
    }))
}

function mapStoredVoucherRows(rows: StoredFileDbRow[]): StoredFileRow[] {
  return rows
    .filter(r => r.storage_key && !r.file_deleted_at && r.file_size_bytes)
    .map(r => ({
      id: r.id,
      type: 'voucher' as const,
      number: r.number,
      label: r.label ?? '',
      date: String(r.date).slice(0, 10),
      file_size_bytes: Number(r.file_size_bytes),
      created_at: r.created_at,
      edit_href: storedFileEditHref('voucher', r.id),
    }))
}

function mapStoredPosterRows(rows: StoredFileDbRow[]): StoredFileRow[] {
  return rows
    .filter(r => r.storage_key && !r.file_deleted_at && r.file_size_bytes)
    .map(r => ({
      id: r.id,
      type: 'poster' as const,
      number: r.number,
      label: r.label ?? '',
      date: String(r.date).slice(0, 10),
      file_size_bytes: Number(r.file_size_bytes),
      created_at: r.created_at,
      edit_href: storedFileEditHref('poster', r.id),
    }))
}

export async function fetchStoredFilesSupabase(createdBy?: string | null): Promise<StoredFileRow[]> {
  const supabase = await createClient()

  type InvoiceRow = {
    id: string
    invoice_number: string
    billed_to_name: string
    invoice_date: string
    file_size_bytes: number
    created_at: string
    storage_key: string | null
    file_deleted_at: string | null
    created_by?: string | null
    invoice_kind?: 'custom' | 'package' | null
  }

  type VoucherRow = {
    id: string
    voucher_number: string
    family_head: string
    voucher_date: string
    file_size_bytes: number
    created_at: string
    storage_key: string | null
    file_deleted_at: string | null
    created_by?: string | null
  }

  type PosterRow = {
    id: string
    poster_number: string
    title: string
    poster_date: string
    file_size_bytes: number
    created_at: string
    storage_key: string | null
    file_deleted_at: string | null
    created_by?: string | null
  }

  async function loadInvoices(withOwner: boolean) {
    let q = supabase
      .from('custom_invoices')
      .select('id, invoice_number, billed_to_name, invoice_date, file_size_bytes, created_at, storage_key, file_deleted_at, created_by, invoice_kind')
      .is('file_deleted_at', null)
      .not('storage_key', 'is', null)
    if (withOwner && createdBy) q = q.eq('created_by', createdBy)
    return q
  }

  async function loadVouchers(withOwner: boolean) {
    let q = supabase
      .from('hotel_vouchers')
      .select('id, voucher_number, family_head, voucher_date, file_size_bytes, created_at, storage_key, file_deleted_at, created_by')
      .is('file_deleted_at', null)
      .not('storage_key', 'is', null)
    if (withOwner && createdBy) q = q.eq('created_by', createdBy)
    return q
  }

  async function loadPosters(withOwner: boolean) {
    let q = supabase
      .from('umrah_posters')
      .select('id, poster_number, title, poster_date, file_size_bytes, created_at, storage_key, file_deleted_at, created_by')
      .is('file_deleted_at', null)
      .not('storage_key', 'is', null)
    if (withOwner && createdBy) q = q.eq('created_by', createdBy)
    return q
  }

  let invoiceRes = await loadInvoices(Boolean(createdBy))
  let voucherRes = await loadVouchers(Boolean(createdBy))
  let posterRes = await loadPosters(Boolean(createdBy))

  if (createdBy && invoiceRes.error && isCreatedBySchemaError(invoiceRes.error.message)) {
    invoiceRes = await loadInvoices(false)
  }
  if (createdBy && voucherRes.error && isCreatedBySchemaError(voucherRes.error.message)) {
    voucherRes = await loadVouchers(false)
  }
  if (createdBy && posterRes.error && isCreatedBySchemaError(posterRes.error.message)) {
    posterRes = await loadPosters(false)
  }

  if (invoiceRes.error) throw new Error(invoiceRes.error.message)
  if (voucherRes.error) throw new Error(voucherRes.error.message)
  if (posterRes.error && !isCreatedBySchemaError(posterRes.error.message)) throw new Error(posterRes.error.message)

  const invoiceRows = (invoiceRes.data ?? []) as InvoiceRow[]
  const voucherRows = (voucherRes.data ?? []) as VoucherRow[]
  const posterRows = posterRes.error ? [] : ((posterRes.data ?? []) as PosterRow[])

  const invoices = mapStoredInvoiceRows(
    invoiceRows
      .filter(r => !createdBy || !r.created_by || r.created_by === createdBy)
      .map(r => ({
        id: r.id,
        number: r.invoice_number,
        label: r.billed_to_name,
        date: r.invoice_date,
        file_size_bytes: r.file_size_bytes,
        created_at: r.created_at,
        storage_key: r.storage_key,
        file_deleted_at: r.file_deleted_at,
        invoice_kind: r.invoice_kind ?? 'custom',
      })),
  )

  const vouchers = mapStoredVoucherRows(
    voucherRows
      .filter(r => !createdBy || !r.created_by || r.created_by === createdBy)
      .map(r => ({
        id: r.id,
        number: r.voucher_number,
        label: r.family_head,
        date: r.voucher_date,
        file_size_bytes: r.file_size_bytes,
        created_at: r.created_at,
        storage_key: r.storage_key,
        file_deleted_at: r.file_deleted_at,
      })),
  )

  const posters = mapStoredPosterRows(
    posterRows
      .filter(r => !createdBy || !r.created_by || r.created_by === createdBy)
      .map(r => ({
        id: r.id,
        number: r.poster_number,
        label: r.title,
        date: r.poster_date,
        file_size_bytes: r.file_size_bytes,
        created_at: r.created_at,
        storage_key: r.storage_key,
        file_deleted_at: r.file_deleted_at,
      })),
  )

  return [...invoices, ...vouchers, ...posters].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function fetchPackageInvoiceByIdSupabase(id: string, createdBy?: string | null): Promise<CustomInvoice | null> {
  const supabase = await createClient()
  const { isPackageInvoice } = await import('@/lib/package-invoice')
  const { mapCustomInvoiceRow } = await import('@/lib/document-db')

  let query = supabase.from('custom_invoices').select('*').eq('id', id)
  if (createdBy) query = query.eq('created_by', createdBy)

  let { data, error } = await query.maybeSingle()
  if (error && createdBy && isCreatedBySchemaError(error.message)) {
    ({ data, error } = await supabase.from('custom_invoices').select('*').eq('id', id).maybeSingle())
  }
  if (error || !data) return null
  if (createdBy && 'created_by' in data && data.created_by && data.created_by !== createdBy) return null

  const mapped = mapCustomInvoiceRow(data as Record<string, unknown>)
  return isPackageInvoice(mapped) ? mapped : null
}

export async function syncStorageUsageSupabase(total_bytes: number): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase.from('storage_usage').select('id').limit(1).maybeSingle()
  const updated_at = new Date().toISOString()
  if (data?.id) {
    await supabase.from('storage_usage').update({ total_bytes, updated_at }).eq('id', data.id)
  } else {
    await supabase.from('storage_usage').insert({ total_bytes, updated_at })
  }
}

/** Storage keys for PDFs that should still exist in R2. */
export async function fetchActiveStorageKeysSupabase(): Promise<string[]> {
  const supabase = await createClient()
  const keys: string[] = []
  const { data: invoices } = await supabase
    .from('custom_invoices')
    .select('storage_key')
    .is('file_deleted_at', null)
    .not('storage_key', 'is', null)
  for (const row of invoices ?? []) {
    if (row.storage_key) keys.push(row.storage_key)
  }
  const { data: vouchers } = await supabase
    .from('hotel_vouchers')
    .select('storage_key')
    .is('file_deleted_at', null)
    .not('storage_key', 'is', null)
  for (const row of vouchers ?? []) {
    if (row.storage_key) keys.push(row.storage_key)
  }
  const { data: posters } = await supabase
    .from('umrah_posters')
    .select('storage_key')
    .is('file_deleted_at', null)
    .not('storage_key', 'is', null)
  for (const row of posters ?? []) {
    if (row.storage_key) keys.push(row.storage_key)
  }
  return keys
}

export async function deleteCustomInvoiceSupabase(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: inv } = await supabase
    .from('custom_invoices')
    .select('storage_key')
    .eq('id', id)
    .maybeSingle()
  if (inv?.storage_key) {
    const { deletePdfKeys } = await import('@/lib/r2')
    await deletePdfKeys([inv.storage_key])
  }
  const { error } = await supabase.from('custom_invoices').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateHotelVoucherSupabase(
  id: string,
  row: {
    voucher_date: string
    reference_no: string
    family_head: string
    package_info: string
    voucher_data: Record<string, unknown>
    storage_key: string
    file_size_bytes: number
  }
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('hotel_vouchers')
    .update({
      voucher_date: row.voucher_date,
      reference_no: row.reference_no,
      family_head: row.family_head,
      package_info: row.package_info,
      voucher_data: row.voucher_data,
      storage_key: row.storage_key,
      file_size_bytes: row.file_size_bytes,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteHotelVoucherSupabase(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: v } = await supabase
    .from('hotel_vouchers')
    .select('storage_key')
    .eq('id', id)
    .maybeSingle()
  if (v?.storage_key) {
    const { deletePdfKeys } = await import('@/lib/r2')
    await deletePdfKeys([v.storage_key])
  }
  const { error } = await supabase.from('hotel_vouchers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchStorageUsageSupabase(): Promise<StorageUsage> {
  const files = await fetchStoredFilesSupabase()
  const usage = storageUsageFromFiles(files)
  try {
    await syncStorageUsageSupabase(usage.total_bytes)
  } catch {
    // Counter sync is best-effort; display still uses computed total.
  }
  return usage
}

export async function insertUmrahPosterSupabase(row: {
  id: string
  title: string
  poster_date: string
  poster_data: Record<string, unknown>
  branding_data: Record<string, unknown>
  calc_data: Record<string, unknown> | null
  storage_key: string
  file_size_bytes: number
  created_by?: string | null
}): Promise<{ id: string; poster_number: string }> {
  const supabase = await createClient()
  const payload = {
    id: row.id,
    title: row.title,
    poster_date: row.poster_date,
    poster_data: row.poster_data,
    branding_data: row.branding_data,
    calc_data: row.calc_data,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
    created_by: row.created_by ?? null,
  }

  let result = await supabase.from('umrah_posters').insert(payload).select('id, poster_number').single()
  if (result.error && isCreatedBySchemaError(result.error.message)) {
    const { created_by: _, ...withoutOwner } = payload
    result = await supabase.from('umrah_posters').insert(withoutOwner).select('id, poster_number').single()
  }
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export async function updateUmrahPosterSupabase(
  id: string,
  row: {
    title: string
    poster_date: string
    poster_data: Record<string, unknown>
    branding_data: Record<string, unknown>
    calc_data: Record<string, unknown> | null
    storage_key: string
    file_size_bytes: number
  },
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('umrah_posters')
    .update({
      title: row.title,
      poster_date: row.poster_date,
      poster_data: row.poster_data,
      branding_data: row.branding_data,
      calc_data: row.calc_data,
      storage_key: row.storage_key,
      file_size_bytes: row.file_size_bytes,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteUmrahPosterSupabase(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: poster } = await supabase
    .from('umrah_posters')
    .select('storage_key')
    .eq('id', id)
    .maybeSingle()
  if (poster?.storage_key) {
    const { deletePdfKeys } = await import('@/lib/r2')
    await deletePdfKeys([poster.storage_key])
  }
  const { error } = await supabase.from('umrah_posters').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchStaffActivityStatsSupabase(): Promise<import('@/lib/types').StaffActivityStats[]> {
  const supabase = await createClient()
  const { data: staffList, error: staffError } = await supabase
    .from('staff_users')
    .select('id, name, username')
    .order('name')
  if (staffError) throw new Error(staffError.message)
  if (!staffList?.length) return []

  type CounterKey = 'bookings' | 'custom_invoices' | 'hotel_vouchers' | 'payments' | 'expenses' | 'umrah_posters'
  const stats = new Map<string, import('@/lib/types').StaffActivityStats>()
  for (const member of staffList) {
    stats.set(member.id, {
      staff_id: member.id,
      staff_name: member.name,
      staff_username: member.username,
      bookings: 0,
      custom_invoices: 0,
      hotel_vouchers: 0,
      payments: 0,
      expenses: 0,
      umrah_posters: 0,
    })
  }

  async function tally(table: string, field: CounterKey) {
    const { data, error } = await supabase.from(table).select('created_by')
    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('schema cache')) return
      throw new Error(error.message)
    }
    for (const row of data ?? []) {
      const id = row.created_by as string | null
      if (!id) continue
      const entry = stats.get(id)
      if (entry) entry[field] += 1
    }
  }

  await Promise.all([
    tally('bookings', 'bookings'),
    tally('custom_invoices', 'custom_invoices'),
    tally('hotel_vouchers', 'hotel_vouchers'),
    tally('payments', 'payments'),
    tally('expenses', 'expenses'),
    tally('umrah_posters', 'umrah_posters'),
  ])

  return [...stats.values()]
}
