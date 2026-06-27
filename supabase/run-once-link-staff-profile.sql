-- Run ONCE in Supabase SQL Editor when login says "no staff profile".
-- Links your existing Auth user to staff_users so the app can load the dashboard.
-- Project: iwzkwkekrswptyipidzc

-- staff_users table (skip if you already ran demo-setup.sql or 001_initial.sql)
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer',
  permission TEXT NOT NULL DEFAULT 'View Only',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON staff_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT ALL ON TABLE public.staff_users TO anon, authenticated, service_role;

-- Link demo@umrahdashboard.pk (or change the email below to yours)
INSERT INTO staff_users (id, name, username, role, permission, status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', 'Demo Admin'),
  'demo',
  'Admin',
  'Full Access',
  'Active'
FROM auth.users u
WHERE u.email = 'demo@umrahdashboard.pk'
  AND NOT EXISTS (SELECT 1 FROM staff_users s WHERE s.id = u.id);

-- Show result — should return 1 row
SELECT s.id, s.name, s.username, s.role, s.permission, s.status, u.email
FROM staff_users s
JOIN auth.users u ON u.id = s.id
WHERE u.email = 'demo@umrahdashboard.pk';

NOTIFY pgrst, 'reload schema';
