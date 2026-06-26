import postgres from 'postgres'
import { requireSql } from '@/lib/sql'
import type { CustomInvoice, CustomInvoiceLineItem, HotelVoucherRecord, StorageUsage, StoredFileRow, StaffActivityStats } from '@/lib/types'

function pgDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'string') return v.slice(0, 10)
  return String(v ?? '')
}

function pgTimestamp(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') return v
  return String(v ?? '')
}

export async function insertCustomInvoice(row: {
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
}) {
  const sql = requireSql()
  const [created] = await sql<{ id: string; invoice_number: string }[]>`
    INSERT INTO custom_invoices (
      id, invoice_date, billed_to_name, billed_to_address, billed_to_client_number,
      payment_bank_name, payment_account_number, terms_text,
      contact_phone, contact_email, contact_location,
      line_items, total, received, remaining,
      storage_key, file_size_bytes, created_by
    ) VALUES (
      ${row.id}, ${row.invoice_date}, ${row.billed_to_name}, ${row.billed_to_address}, ${row.billed_to_client_number},
      ${row.payment_bank_name}, ${row.payment_account_number}, ${row.terms_text},
      ${row.contact_phone}, ${row.contact_email}, ${row.contact_location},
      ${sql.json(row.line_items as unknown as postgres.JSONValue)}, ${row.total}, ${row.received}, ${row.remaining},
      ${row.storage_key}, ${row.file_size_bytes}, ${row.created_by ?? null}
    )
    RETURNING id, invoice_number
  `
  return created
}

export async function fetchCustomInvoices(createdBy?: string | null): Promise<CustomInvoice[]> {
  const sql = requireSql()
  const rows = createdBy
    ? await sql<CustomInvoice[]>`
        SELECT * FROM custom_invoices
        WHERE created_by = ${createdBy}
        ORDER BY created_at DESC
      `
    : await sql<CustomInvoice[]>`
        SELECT * FROM custom_invoices ORDER BY created_at DESC
      `
  return rows.map(r => ({
    ...r,
    invoice_date: pgDate(r.invoice_date),
    created_at: pgTimestamp(r.created_at),
    file_deleted_at: r.file_deleted_at ? pgTimestamp(r.file_deleted_at) : null,
    line_items: typeof r.line_items === 'string' ? JSON.parse(r.line_items) : r.line_items,
    total: Number(r.total),
    received: Number(r.received),
    remaining: Number(r.remaining),
    file_size_bytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
  }))
}

export async function insertHotelVoucher(row: {
  id: string
  voucher_date: string
  reference_no: string
  family_head: string
  package_info: string
  voucher_data: Record<string, unknown>
  storage_key: string
  file_size_bytes: number
  created_by?: string | null
}) {
  const sql = requireSql()
  const [created] = await sql<{ id: string; voucher_number: string }[]>`
    INSERT INTO hotel_vouchers (
      id, voucher_date, reference_no, family_head, package_info,
      voucher_data, storage_key, file_size_bytes, created_by
    ) VALUES (
      ${row.id}, ${row.voucher_date}, ${row.reference_no}, ${row.family_head}, ${row.package_info},
      ${sql.json(row.voucher_data as postgres.JSONValue)}, ${row.storage_key}, ${row.file_size_bytes}, ${row.created_by ?? null}
    )
    RETURNING id, voucher_number
  `
  return created
}

export async function fetchHotelVouchers(createdBy?: string | null): Promise<HotelVoucherRecord[]> {
  const sql = requireSql()
  const rows = createdBy
    ? await sql<HotelVoucherRecord[]>`
        SELECT * FROM hotel_vouchers
        WHERE created_by = ${createdBy}
        ORDER BY created_at DESC
      `
    : await sql<HotelVoucherRecord[]>`
        SELECT * FROM hotel_vouchers ORDER BY created_at DESC
      `
  return rows.map(r => ({
    ...r,
    voucher_date: pgDate(r.voucher_date),
    created_at: pgTimestamp(r.created_at),
    file_deleted_at: r.file_deleted_at ? pgTimestamp(r.file_deleted_at) : null,
  }))
}

export async function fetchStorageUsage(): Promise<StorageUsage> {
  const sql = requireSql()
  const [row] = await sql<StorageUsage[]>`
    SELECT * FROM storage_usage LIMIT 1
  `
  return row
    ? { ...row, total_bytes: Number(row.total_bytes), updated_at: pgTimestamp(row.updated_at) }
    : { id: '', total_bytes: 0, updated_at: new Date().toISOString() }
}

export async function fetchStoredFiles(createdBy?: string | null): Promise<StoredFileRow[]> {
  const sql = requireSql()
  const invoices = createdBy
    ? await sql<StoredFileRow[]>`
        SELECT id, 'invoice'::text AS type, invoice_number AS number,
               billed_to_name AS label, invoice_date::text AS date,
               file_size_bytes, created_at
        FROM custom_invoices
        WHERE file_deleted_at IS NULL AND storage_key IS NOT NULL AND created_by = ${createdBy}
      `
    : await sql<StoredFileRow[]>`
        SELECT id, 'invoice'::text AS type, invoice_number AS number,
               billed_to_name AS label, invoice_date::text AS date,
               file_size_bytes, created_at
        FROM custom_invoices
        WHERE file_deleted_at IS NULL AND storage_key IS NOT NULL
      `
  const vouchers = createdBy
    ? await sql<StoredFileRow[]>`
        SELECT id, 'voucher'::text AS type, voucher_number AS number,
               family_head AS label, voucher_date::text AS date,
               file_size_bytes, created_at
        FROM hotel_vouchers
        WHERE file_deleted_at IS NULL AND storage_key IS NOT NULL AND created_by = ${createdBy}
      `
    : await sql<StoredFileRow[]>`
        SELECT id, 'voucher'::text AS type, voucher_number AS number,
               family_head AS label, voucher_date::text AS date,
               file_size_bytes, created_at
        FROM hotel_vouchers
        WHERE file_deleted_at IS NULL AND storage_key IS NOT NULL
      `
  return [...invoices, ...vouchers]
    .map(r => ({
      ...r,
      date: pgDate(r.date),
      created_at: pgTimestamp(r.created_at),
      file_size_bytes: Number(r.file_size_bytes),
    }))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function softDeleteFileRow(id: string, type: 'invoice' | 'voucher') {
  const sql = requireSql()
  const table = type === 'invoice' ? 'custom_invoices' : 'hotel_vouchers'
  if (table === 'custom_invoices') {
    const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null }[]>`
      SELECT storage_key, file_deleted_at FROM custom_invoices WHERE id = ${id}
    `
    return row
  }
  const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null }[]>`
    SELECT storage_key, file_deleted_at FROM hotel_vouchers WHERE id = ${id}
  `
  return row
}

export async function markFileDeleted(id: string, type: 'invoice' | 'voucher', deletedAt: string) {
  const sql = requireSql()
  if (type === 'invoice') {
    await sql`UPDATE custom_invoices SET file_deleted_at = ${deletedAt} WHERE id = ${id}`
  } else {
    await sql`UPDATE hotel_vouchers SET file_deleted_at = ${deletedAt} WHERE id = ${id}`
  }
}

export async function fetchFileForDownload(id: string, type: 'invoice' | 'voucher') {
  const sql = requireSql()
  if (type === 'invoice') {
    const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null; invoice_number: string; created_by: string | null }[]>`
      SELECT storage_key, file_deleted_at, invoice_number, created_by FROM custom_invoices WHERE id = ${id}
    `
    return row ? { ...row, number: row.invoice_number } : null
  }
  const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null; voucher_number: string; created_by: string | null }[]>`
    SELECT storage_key, file_deleted_at, voucher_number, created_by FROM hotel_vouchers WHERE id = ${id}
  `
  return row ? { ...row, number: row.voucher_number } : null
}

export async function fetchFileForBulkDownload(id: string, type: 'invoice' | 'voucher') {
  const sql = requireSql()
  if (type === 'invoice') {
    const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null; invoice_number: string }[]>`
      SELECT storage_key, file_deleted_at, invoice_number FROM custom_invoices WHERE id = ${id}
    `
    return row?.storage_key && !row.file_deleted_at
      ? { name: `${row.invoice_number}.pdf`, storage_key: row.storage_key }
      : null
  }
  const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null; voucher_number: string }[]>`
    SELECT storage_key, file_deleted_at, voucher_number FROM hotel_vouchers WHERE id = ${id}
  `
  return row?.storage_key && !row.file_deleted_at
    ? { name: `${row.voucher_number}.pdf`, storage_key: row.storage_key }
    : null
}

export async function fetchStaffActivityStats(): Promise<StaffActivityStats[]> {
  const sql = requireSql()
  const rows = await sql<StaffActivityStats[]>`
    SELECT
      s.id AS staff_id,
      s.name AS staff_name,
      (SELECT COUNT(*)::int FROM bookings WHERE created_by = s.id) AS bookings,
      (SELECT COUNT(*)::int FROM custom_invoices WHERE created_by = s.id) AS custom_invoices,
      (SELECT COUNT(*)::int FROM hotel_vouchers WHERE created_by = s.id) AS hotel_vouchers,
      (SELECT COUNT(*)::int FROM payments WHERE created_by = s.id) AS payments,
      (SELECT COUNT(*)::int FROM expenses WHERE created_by = s.id) AS expenses
    FROM staff_users s
    ORDER BY s.name
  `
  return rows.map(r => ({
    staff_id: r.staff_id,
    staff_name: r.staff_name,
    bookings: Number(r.bookings),
    custom_invoices: Number(r.custom_invoices),
    hotel_vouchers: Number(r.hotel_vouchers),
    payments: Number(r.payments),
    expenses: Number(r.expenses),
  }))
}
