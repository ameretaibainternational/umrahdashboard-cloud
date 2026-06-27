-- Run after creating new tables if the app shows "schema cache" errors.
-- Tables already exist in Postgres; this refreshes Supabase API + grants access.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

SELECT 'Schema cache reload requested. Wait 10 seconds, then try again.' AS status;
