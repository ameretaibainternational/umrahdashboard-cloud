/** Map database errors to actionable hints. */
export function friendlyDbError(message: string): string {
  if (message.includes('DATABASE_URL is missing')) return message

  if (message.includes('DATABASE_URL connection unavailable')) {
    return 'Could not connect via DATABASE_URL. If save still fails, run supabase/setup-missing-tables.sql in the Supabase SQL Editor.'
  }

  if (message.includes('DATABASE_URL is for Supabase project')) return message

  if (message.includes('password authentication failed')) {
    return 'Database password rejected. In Supabase → Settings → Database, reset the database password for your project, paste it into DATABASE_PASSWORD in .env.local, restart npm run dev. Make sure NEXT_PUBLIC_SUPABASE_URL and DATABASE_URL use the same project ID.'
  }

  if (message.includes('ECIRCUITBREAKER') || message.includes('too many authentication failures')) {
    return 'Too many failed DATABASE_URL login attempts — Supabase blocked new connections briefly. Comment out DATABASE_URL in .env.local and restart dev, or fix the password and wait a few minutes.'
  }

  if (message.includes('UPDATE requires a WHERE clause')) {
    return 'Storage trigger needs a fix. In Supabase SQL Editor, run supabase/fix-storage-triggers.sql, then try saving again.'
  }

  if (message.includes('custom_invoices') && message.includes('does not exist')) {
    return 'Table custom_invoices is missing. In Supabase → SQL Editor, open supabase/setup-missing-tables.sql from this project, press Ctrl+A then Run. The last result must list 4 tables including custom_invoices.'
  }

  if (message.includes('schema cache') && message.includes('custom_invoices')) {
    return 'Tables exist in the database, but Supabase API has not refreshed yet. Fix both: (1) In Supabase → Settings → Database, reset the database password, URL-encode it in DATABASE_URL (@ → %40, $ → %24), restart npm run dev. (2) In SQL Editor run: NOTIFY pgrst, \'reload schema\'; then try again.'
  }

  if (message.includes('schema cache') && message.includes('created_by')) {
    return 'Booking could not be saved. If this persists, run supabase/run-once-staff-roles.sql in Supabase SQL Editor, or fix DATABASE_URL in your environment variables.'
  }

  if (message.includes('violates foreign key constraint') && message.includes('created_by')) {
    return 'DATABASE_URL must point to the same Supabase project as NEXT_PUBLIC_SUPABASE_URL. Copy the connection string from that project’s dashboard (Settings → Database → URI, port 6543).'
  }

  return message
}
