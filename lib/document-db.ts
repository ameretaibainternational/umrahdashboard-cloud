import postgres from 'postgres'
import {
  hasDirectDb,
  isDirectDbConnectionError,
  isDirectDbRecoverableError,
  markDirectDbAuthFailed,
  markDirectDbAvailable,
  requireSql,
  requireWriteSql,
} from '@/lib/sql'
import type { CustomInvoice, CustomInvoiceLineItem, HotelVoucherRecord, PackageInvoiceData, StorageUsage, StoredFileRow, StaffActivityStats } from '@/lib/types'
import { decodePackageDataFromTerms, encodePackageDataInTerms } from '@/lib/package-invoice'

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

async function withDocumentDbFallback<T>(direct: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (hasDirectDb()) {
    try {
      const result = await direct()
      markDirectDbAvailable()
      return result
    } catch (error) {
      if (!isDirectDbRecoverableError(error)) throw error
      if (isDirectDbConnectionError(error)) markDirectDbAuthFailed()
    }
  }
  return fallback()
}

async function insertCustomInvoiceDirect(row: {
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
}, options?: { force?: boolean }) {
  const sql = requireWriteSql(options)
  const baseValues = {
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
    line_items: sql.json(row.line_items as unknown as postgres.JSONValue),
    total: row.total,
    received: row.received,
    remaining: row.remaining,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
  }

  try {
    const [created] = await sql<{ id: string; invoice_number: string }[]>`
      INSERT INTO custom_invoices (
        id, invoice_date, billed_to_name, billed_to_address, billed_to_client_number,
        payment_bank_name, payment_account_number, terms_text,
        contact_phone, contact_email, contact_location,
        line_items, total, received, remaining,
        storage_key, file_size_bytes, created_by
      ) VALUES (
        ${baseValues.id}, ${baseValues.invoice_date}, ${baseValues.billed_to_name}, ${baseValues.billed_to_address}, ${baseValues.billed_to_client_number},
        ${baseValues.payment_bank_name}, ${baseValues.payment_account_number}, ${baseValues.terms_text},
        ${baseValues.contact_phone}, ${baseValues.contact_email}, ${baseValues.contact_location},
        ${baseValues.line_items}, ${baseValues.total}, ${baseValues.received}, ${baseValues.remaining},
        ${baseValues.storage_key}, ${baseValues.file_size_bytes}, ${row.created_by ?? null}
      )
      RETURNING id, invoice_number
    `
    return created
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('created_by')) throw error
    const [created] = await sql<{ id: string; invoice_number: string }[]>`
      INSERT INTO custom_invoices (
        id, invoice_date, billed_to_name, billed_to_address, billed_to_client_number,
        payment_bank_name, payment_account_number, terms_text,
        contact_phone, contact_email, contact_location,
        line_items, total, received, remaining,
        storage_key, file_size_bytes
      ) VALUES (
        ${baseValues.id}, ${baseValues.invoice_date}, ${baseValues.billed_to_name}, ${baseValues.billed_to_address}, ${baseValues.billed_to_client_number},
        ${baseValues.payment_bank_name}, ${baseValues.payment_account_number}, ${baseValues.terms_text},
        ${baseValues.contact_phone}, ${baseValues.contact_email}, ${baseValues.contact_location},
        ${baseValues.line_items}, ${baseValues.total}, ${baseValues.received}, ${baseValues.remaining},
        ${baseValues.storage_key}, ${baseValues.file_size_bytes}
      )
      RETURNING id, invoice_number
    `
    return created
  }
}

export { insertCustomInvoiceDirect }

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

export function mapCustomInvoiceRow(r: Record<string, unknown>): CustomInvoice {
  const termsText = String(r.terms_text ?? '')
  let packageData = r.package_data
    ? (typeof r.package_data === 'string' ? JSON.parse(r.package_data) : r.package_data) as PackageInvoiceData
    : null
  if (!packageData) {
    packageData = decodePackageDataFromTerms(termsText)
  }
  return {
    ...(r as unknown as CustomInvoice),
    invoice_date: pgDate(r.invoice_date),
    created_at: pgTimestamp(r.created_at),
    file_deleted_at: r.file_deleted_at ? pgTimestamp(r.file_deleted_at) : null,
    line_items: typeof r.line_items === 'string' ? JSON.parse(r.line_items) : (r.line_items as CustomInvoice['line_items']),
    invoice_kind: ((r.invoice_kind as CustomInvoice['invoice_kind']) ?? 'custom'),
    package_data: packageData,
    total: Number(r.total),
    received: Number(r.received),
    remaining: Number(r.remaining),
    file_size_bytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
  }
}

export async function insertPackageInvoiceDirect(row: PackageInvoiceRow, options?: { force?: boolean }) {
  const sql = requireWriteSql(options)
  const packageJson = sql.json(row.package_data as unknown as postgres.JSONValue)
  const baseValues = {
    id: row.id,
    invoice_number: row.invoice_number,
    invoice_date: row.invoice_date,
    billed_to_name: row.billed_to_name,
    total: row.total,
    received: row.received,
    remaining: row.remaining,
    storage_key: row.storage_key,
    file_size_bytes: row.file_size_bytes,
    contact_phone: row.contact_phone ?? '',
    contact_email: row.contact_email ?? '',
    contact_location: row.contact_location ?? '',
    package_data: packageJson,
  }

  try {
    const [created] = await sql<{ id: string; invoice_number: string }[]>`
      INSERT INTO custom_invoices (
        id, invoice_number, invoice_date, billed_to_name,
        payment_bank_name, payment_account_number, terms_text,
        contact_phone, contact_email, contact_location,
        line_items, total, received, remaining,
        storage_key, file_size_bytes, created_by,
        invoice_kind, package_data
      ) VALUES (
        ${baseValues.id}, ${baseValues.invoice_number}, ${baseValues.invoice_date}, ${baseValues.billed_to_name},
        '', '', '',
        ${baseValues.contact_phone}, ${baseValues.contact_email}, ${baseValues.contact_location},
        '[]', ${baseValues.total}, ${baseValues.received}, ${baseValues.remaining},
        ${baseValues.storage_key}, ${baseValues.file_size_bytes}, ${row.created_by ?? null},
        'package', ${baseValues.package_data}
      )
      RETURNING id, invoice_number
    `
    return created
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('invoice_kind') || message.includes('package_data')) {
      const termsBackup = encodePackageDataInTerms(row.package_data)
      const [created] = await sql<{ id: string; invoice_number: string }[]>`
        INSERT INTO custom_invoices (
          id, invoice_number, invoice_date, billed_to_name,
          payment_bank_name, payment_account_number, terms_text,
          contact_phone, contact_email, contact_location,
          line_items, total, received, remaining,
          storage_key, file_size_bytes, created_by
        ) VALUES (
          ${baseValues.id}, ${baseValues.invoice_number}, ${baseValues.invoice_date}, ${baseValues.billed_to_name},
          '', '', ${termsBackup},
          ${baseValues.contact_phone}, ${baseValues.contact_email}, ${baseValues.contact_location},
          '[]', ${baseValues.total}, ${baseValues.received}, ${baseValues.remaining},
          ${baseValues.storage_key}, ${baseValues.file_size_bytes}, ${row.created_by ?? null}
        )
        RETURNING id, invoice_number
      `
      return created
    }
    if (!message.includes('created_by')) throw error
    const [created] = await sql<{ id: string; invoice_number: string }[]>`
      INSERT INTO custom_invoices (
        id, invoice_number, invoice_date, billed_to_name,
        payment_bank_name, payment_account_number, terms_text,
        contact_phone, contact_email, contact_location,
        line_items, total, received, remaining,
        storage_key, file_size_bytes,
        invoice_kind, package_data
      ) VALUES (
        ${baseValues.id}, ${baseValues.invoice_number}, ${baseValues.invoice_date}, ${baseValues.billed_to_name},
        '', '', '',
        ${baseValues.contact_phone}, ${baseValues.contact_email}, ${baseValues.contact_location},
        '[]', ${baseValues.total}, ${baseValues.received}, ${baseValues.remaining},
        ${baseValues.storage_key}, ${baseValues.file_size_bytes},
        'package', ${baseValues.package_data}
      )
      RETURNING id, invoice_number
    `
    return created
  }
}

export async function updatePackageInvoiceDirect(row: PackageInvoiceRow, options?: { force?: boolean }) {
  const sql = requireWriteSql(options)
  const packageJson = sql.json(row.package_data as unknown as postgres.JSONValue)
  try {
    await sql`
      UPDATE custom_invoices SET
        invoice_date = ${row.invoice_date},
        billed_to_name = ${row.billed_to_name},
        contact_phone = ${row.contact_phone ?? ''},
        contact_email = ${row.contact_email ?? ''},
        contact_location = ${row.contact_location ?? ''},
        total = ${row.total},
        received = ${row.received},
        remaining = ${row.remaining},
        storage_key = ${row.storage_key},
        file_size_bytes = ${row.file_size_bytes},
        package_data = ${packageJson},
        invoice_kind = 'package'
      WHERE id = ${row.id}
    `
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('invoice_kind') || message.includes('package_data')) {
      const termsBackup = encodePackageDataInTerms(row.package_data)
      await sql`
        UPDATE custom_invoices SET
          invoice_date = ${row.invoice_date},
          billed_to_name = ${row.billed_to_name},
          contact_phone = ${row.contact_phone ?? ''},
          contact_email = ${row.contact_email ?? ''},
          contact_location = ${row.contact_location ?? ''},
          terms_text = ${termsBackup},
          total = ${row.total},
          received = ${row.received},
          remaining = ${row.remaining},
          storage_key = ${row.storage_key},
          file_size_bytes = ${row.file_size_bytes}
        WHERE id = ${row.id}
      `
    } else {
      throw error
    }
  }
  return { id: row.id, invoice_number: row.invoice_number }
}

export async function fetchPackageInvoiceById(id: string, createdBy?: string | null): Promise<CustomInvoice | null> {
  const sql = requireSql()
  const rows = createdBy
    ? await sql<Record<string, unknown>[]>`
        SELECT * FROM custom_invoices
        WHERE id = ${id} AND created_by = ${createdBy}
        LIMIT 1
      `
    : await sql<Record<string, unknown>[]>`
        SELECT * FROM custom_invoices WHERE id = ${id} LIMIT 1
      `
  const row = rows[0]
  if (!row) return null
  const mapped = mapCustomInvoiceRow(row)
  const { isPackageInvoice } = await import('@/lib/package-invoice')
  return isPackageInvoice(mapped) ? mapped : null
}

export async function insertPackageInvoice(row: PackageInvoiceRow) {
  return withDocumentDbFallback(
    () => insertPackageInvoiceDirect(row),
    async () => {
      const { insertPackageInvoiceSupabase } = await import('@/lib/supabase-document-db')
      return insertPackageInvoiceSupabase(row)
    },
  )
}

export async function updatePackageInvoice(row: PackageInvoiceRow) {
  return withDocumentDbFallback(
    () => updatePackageInvoiceDirect(row),
    async () => {
      const { updatePackageInvoiceSupabase } = await import('@/lib/supabase-document-db')
      return updatePackageInvoiceSupabase(row)
    },
  )
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
  return withDocumentDbFallback(
    () => insertCustomInvoiceDirect(row),
    async () => {
      const { insertCustomInvoiceSupabase } = await import('@/lib/supabase-document-db')
      return insertCustomInvoiceSupabase(row)
    },
  )
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
  return rows.map(r => mapCustomInvoiceRow(r as unknown as Record<string, unknown>))
}

async function insertHotelVoucherDirect(row: {
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
  const sql = requireWriteSql()
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
  return withDocumentDbFallback(
    () => insertHotelVoucherDirect(row),
    async () => {
      const { insertHotelVoucherSupabase } = await import('@/lib/supabase-document-db')
      return insertHotelVoucherSupabase(row)
    },
  )
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
  return withDocumentDbFallback(
    async () => {
      const sql = requireSql()
      if (type === 'invoice') {
        const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null }[]>`
          SELECT storage_key, file_deleted_at FROM custom_invoices WHERE id = ${id}
        `
        return row
      }
      const [row] = await sql<{ storage_key: string | null; file_deleted_at: string | null }[]>`
        SELECT storage_key, file_deleted_at FROM hotel_vouchers WHERE id = ${id}
      `
      return row
    },
    async () => {
      const { softDeleteFileRowSupabase } = await import('@/lib/supabase-document-db')
      return softDeleteFileRowSupabase(id, type)
    },
  )
}

export async function markFileDeleted(id: string, type: 'invoice' | 'voucher', deletedAt: string) {
  return withDocumentDbFallback(
    async () => {
      const sql = requireWriteSql()
      if (type === 'invoice') {
        await sql`UPDATE custom_invoices SET file_deleted_at = ${deletedAt} WHERE id = ${id}`
      } else {
        await sql`UPDATE hotel_vouchers SET file_deleted_at = ${deletedAt} WHERE id = ${id}`
      }
    },
    async () => {
      const { markFileDeletedSupabase } = await import('@/lib/supabase-document-db')
      await markFileDeletedSupabase(id, type, deletedAt)
    },
  )
}

export async function fetchFileForDownload(id: string, type: 'invoice' | 'voucher') {
  return withDocumentDbFallback(
    async () => {
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
    },
    async () => {
      const { fetchFileForDownloadSupabase } = await import('@/lib/supabase-document-db')
      return fetchFileForDownloadSupabase(id, type)
    },
  )
}

export async function fetchFileForBulkDownload(id: string, type: 'invoice' | 'voucher') {
  return withDocumentDbFallback(
    async () => {
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
    },
    async () => {
      const { fetchFileForBulkDownloadSupabase } = await import('@/lib/supabase-document-db')
      return fetchFileForBulkDownloadSupabase(id, type)
    },
  )
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
