-- Optional: expose new tables to Supabase Data API (REST) if you want supabase-js .from() to work.
-- Custom invoices & hotel vouchers now use DATABASE_URL direct connection instead,
-- so this is only needed if you want REST API access too.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.invoice_settings TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_invoices TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hotel_voucher_settings TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.hotel_vouchers TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.storage_usage TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE public.custom_invoice_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.hotel_voucher_seq TO anon, authenticated, service_role;

SELECT pg_notification_queue_usage();
NOTIFY pgrst, 'reload schema';

SELECT 'Data API grants applied. App uses DATABASE_URL direct connection regardless.' AS status;
