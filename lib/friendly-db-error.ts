/** Map database errors to actionable hints. */
export function friendlyDbError(message: string): string {
  if (message.includes('DATABASE_URL is missing')) return message

  if (message.includes('DATABASE_URL is for Supabase project')) return message

  if (message.includes('password authentication failed')) {
    return 'DATABASE_URL password is wrong. In Supabase → Settings → Database, reset the database password, URL-encode special characters (@ → %40, $ → %24), update .env.local, and restart npm run dev.'
  }

  if (message.includes('custom_invoices') && message.includes('does not exist')) {
    return 'Table custom_invoices is missing. Run supabase/setup-missing-tables.sql in Supabase SQL Editor (Ctrl+A → Run).'
  }

  if (message.includes('schema cache') && message.includes('created_by')) {
    return 'Booking could not be saved. If this persists, run supabase/run-once-staff-roles.sql in Supabase SQL Editor, or fix DATABASE_URL in your environment variables.'
  }

  if (message.includes('violates foreign key constraint') && message.includes('created_by')) {
    return 'DATABASE_URL must point to the same Supabase project as NEXT_PUBLIC_SUPABASE_URL. Copy the connection string from that project’s dashboard (Settings → Database → URI, port 6543).'
  }

  return message
}
