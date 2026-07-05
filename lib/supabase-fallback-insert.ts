import { createClient } from '@/lib/supabase/server'

function isCreatedBySchemaError(message: string): boolean {
  return message.includes('created_by') || message.includes('schema cache')
}

/** Insert via Supabase API; retries without created_by when PostgREST schema is stale. */
export async function supabaseInsertRow(
  table: 'bookings' | 'payments' | 'expenses',
  row: Record<string, unknown>,
  createdBy: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const withOwner = { ...row, created_by: createdBy }
  const { error } = await supabase.from(table).insert(withOwner)
  if (!error) return { error: null }
  if (!isCreatedBySchemaError(error.message)) return { error: error.message }

  const { error: retryError } = await supabase.from(table).insert(row)
  return { error: retryError?.message ?? null }
}
