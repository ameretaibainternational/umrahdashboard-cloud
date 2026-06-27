-- ============================================================
-- Fast Travels Umrah CRM — DEMO SETUP (All-in-One)
-- Run this ONCE in your new Supabase project's SQL Editor.
-- It creates all tables, RLS policies, seed data, and the
-- demo admin user in one shot.
-- ============================================================


-- ============================================================
-- SECTION 1: Tables
-- ============================================================

-- Staff users (linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer',
  permission TEXT NOT NULL DEFAULT 'View Only',
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Company settings (single row)
CREATE TABLE IF NOT EXISTS company (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Fast Travels & Tours',
  license TEXT DEFAULT 'Govt License',
  phone TEXT DEFAULT '',
  website TEXT DEFAULT 'fasttravels.pk',
  address TEXT DEFAULT 'Pakistan',
  logo_url TEXT DEFAULT ''
);

-- Visa settings (single row, with tiered rates)
CREATE TABLE IF NOT EXISTS visa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adult_sar NUMERIC NOT NULL DEFAULT 600,
  child_sar NUMERIC NOT NULL DEFAULT 600,
  infant_sar NUMERIC NOT NULL DEFAULT 460,
  transport_mode TEXT NOT NULL DEFAULT 'included',
  visa_rate_1_pax NUMERIC NOT NULL DEFAULT 725,
  visa_rate_2_pax NUMERIC NOT NULL DEFAULT 700,
  visa_rate_3_pax NUMERIC NOT NULL DEFAULT 675,
  visa_rate_4_pax NUMERIC NOT NULL DEFAULT 650,
  visa_rate_group_pax NUMERIC NOT NULL DEFAULT 600,
  makkah_ziarat_rate NUMERIC NOT NULL DEFAULT 0,
  madina_ziarat_rate NUMERIC NOT NULL DEFAULT 0
);

-- Currency settings (single row)
CREATE TABLE IF NOT EXISTS currency_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sar_to_pkr NUMERIC NOT NULL DEFAULT 75
);

-- Transport rates
CREATE TABLE IF NOT EXISTS transport_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('bus', 'private')),
  pax_count INT NOT NULL CHECK (pax_count BETWEEN 1 AND 4),
  rate_sar NUMERIC NOT NULL,
  UNIQUE(type, pax_count)
);

-- Airlines
CREATE TABLE IF NOT EXISTS airlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  adult_pkr NUMERIC NOT NULL DEFAULT 0,
  child_pkr NUMERIC NOT NULL DEFAULT 0,
  infant_pkr NUMERIC NOT NULL DEFAULT 0
);

-- Hotels
CREATE TABLE IF NOT EXISTS hotels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL CHECK (city IN ('Makkah', 'Madinah')),
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  distance TEXT DEFAULT '',
  sharing_sar NUMERIC DEFAULT 0,
  quad_sar NUMERIC DEFAULT 0,
  triple_sar NUMERIC DEFAULT 0,
  double_sar NUMERIC DEFAULT 0,
  UNIQUE(name, city)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
  airline_name TEXT NOT NULL,
  total_pkr NUMERIC NOT NULL,
  cost_pkr NUMERIC NOT NULL,
  profit_pkr NUMERIC NOT NULL,
  advance_pkr NUMERIC DEFAULT 0,
  paid_pkr NUMERIC DEFAULT 0,
  remaining_pkr NUMERIC NOT NULL,
  adult_count INT DEFAULT 1,
  child_count INT DEFAULT 0,
  infant_count INT DEFAULT 0,
  makkah_hotel_name TEXT,
  makkah_hotel_location TEXT,
  makkah_hotel_distance TEXT,
  makkah_room_type TEXT,
  makkah_nights INT,
  madinah_hotel_name TEXT,
  madinah_hotel_location TEXT,
  madinah_hotel_distance TEXT,
  madinah_room_type TEXT,
  madinah_nights INT
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  amount_pkr NUMERIC NOT NULL,
  method TEXT NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash','Bank','JazzCash','EasyPaisa')),
  note TEXT DEFAULT ''
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'Umrah Supplier',
    'Airline / Ticket',
    'Hotel Supplier',
    'Transport Supplier',
    'Other Umrah Expense'
  )),
  supplier TEXT NOT NULL,
  amount_pkr NUMERIC NOT NULL CHECK (amount_pkr > 0),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'Bank', 'JazzCash', 'EasyPaisa')),
  note TEXT NOT NULL DEFAULT ''
);


-- ============================================================
-- SECTION 2: Row Level Security
-- ============================================================

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE airlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON staff_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON company FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON visa_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON currency_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON transport_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON airlines FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON hotels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage expenses"
  ON expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- SECTION 3: Seed Data
-- ============================================================

INSERT INTO company (name, license, phone, website, address)
VALUES ('Fast Travels & Tours', 'Govt License', '', 'fasttravels.pk', 'Pakistan')
ON CONFLICT DO NOTHING;

INSERT INTO visa_settings (
  adult_sar, child_sar, infant_sar, transport_mode,
  visa_rate_1_pax, visa_rate_2_pax, visa_rate_3_pax, visa_rate_4_pax, visa_rate_group_pax,
  makkah_ziarat_rate, madina_ziarat_rate
) VALUES (600, 600, 460, 'included', 725, 700, 675, 650, 600, 0, 0)
ON CONFLICT DO NOTHING;

INSERT INTO currency_settings (sar_to_pkr) VALUES (75)
ON CONFLICT DO NOTHING;

INSERT INTO transport_rates (type, pax_count, rate_sar) VALUES
  ('bus', 1, 750), ('bus', 2, 700), ('bus', 3, 670), ('bus', 4, 650),
  ('private', 1, 900), ('private', 2, 750), ('private', 3, 700), ('private', 4, 675)
ON CONFLICT (type, pax_count) DO NOTHING;

INSERT INTO airlines (name, adult_pkr, child_pkr, infant_pkr) VALUES
  ('Saudi Airlines', 85000, 75000, 15000),
  ('AirSial', 75000, 65000, 12000),
  ('Flynas', 78000, 68000, 13000),
  ('Serene Air', 80000, 70000, 14000)
ON CONFLICT (name) DO NOTHING;

-- Makkah Hotels
INSERT INTO hotels (city, name, location, distance, sharing_sar, quad_sar, triple_sar, double_sar) VALUES
  ('Makkah', 'Hilton Suites Makkah', 'Abraj Al-Bait', '50-100 MTR', 450, 550, 700, 950),
  ('Makkah', 'Swissotel Makkah', 'Abraj Al-Bait', '50-100 MTR', 420, 520, 670, 920),
  ('Makkah', 'Conrad Makkah', 'Abraj Al-Bait', '50-100 MTR', 400, 500, 650, 900),
  ('Makkah', 'Fairmont Makkah Clock Royal Tower', 'Abraj Al-Bait', '50 MTR', 550, 650, 800, 1100),
  ('Makkah', 'Pullman ZamZam Makkah', 'Abraj Al-Bait', '100-200 MTR', 350, 450, 600, 850),
  ('Makkah', 'Anjum Hotel Makkah', 'Al Haram', '200-300 MTR', 300, 400, 550, 800),
  ('Makkah', 'Al Safwah Royale Orchid Hotel', 'Al Haram', '300-400 MTR', 250, 350, 500, 750),
  ('Makkah', 'Makkah Clock Royal Tower', 'Abraj Al-Bait', '50 MTR', 500, 600, 750, 1000),
  ('Makkah', 'Dar Al Taqwa Hotel', 'Al Haram', '200 MTR', 280, 380, 530, 780),
  ('Makkah', 'Al Marwa Rayhaan by Rotana', 'Al Haram', '300 MTR', 270, 370, 520, 770),
  ('Makkah', 'Sheraton Makkah Jabal Al Kaaba', 'Al Haram', '500 MTR', 240, 340, 490, 740),
  ('Makkah', 'Al Massa Hotel Makkah', 'Al Haram', '600-700 MTR', 200, 300, 450, 700),
  ('Makkah', 'Grand Millennium Makkah', 'Al Haram', '700-800 MTR', 180, 280, 430, 680),
  ('Makkah', 'Elaf Al Mashaer Hotel', 'Al Haram', '800-900 MTR', 150, 250, 400, 650),
  ('Makkah', 'Al Kiswah Tower Hotel', 'Al Haram', '1 KM', 140, 240, 390, 640),
  ('Makkah', 'Makkah Millennium Hotel', 'Al Haram', '1-2 KM', 130, 230, 380, 630),
  ('Makkah', 'Jabal Omar Hyatt Regency Makkah', 'Jabal Omar', '500 MTR', 320, 420, 570, 820),
  ('Makkah', 'Bakkah Hotel', 'Al Haram', '1.5 KM', 120, 220, 370, 620),
  ('Makkah', 'Al Rayyan Hotel Makkah', 'Al Haram', 'Shuttle Service', 100, 200, 350, 600),
  ('Makkah', 'Rawaq Hotel Makkah', 'Al Haram', 'Shuttle Service', 90, 190, 340, 590)
ON CONFLICT (name, city) DO NOTHING;

-- Madinah Hotels
INSERT INTO hotels (city, name, location, distance, sharing_sar, quad_sar, triple_sar, double_sar) VALUES
  ('Madinah', 'Anwar Al Madinah Mövenpick Hotel', 'Al Haram', '50-100 MTR', 300, 400, 550, 800),
  ('Madinah', 'Madinah Hilton Hotel', 'Al Haram', '100-200 MTR', 280, 380, 530, 780),
  ('Madinah', 'Al Shohada Hotel', 'Al Haram', '100 MTR', 260, 360, 510, 760),
  ('Madinah', 'Dar Al Iman Intercontinental', 'Al Haram', '200 MTR', 240, 340, 490, 740),
  ('Madinah', 'Pullman Zamzam Madinah', 'Al Haram', '300 MTR', 220, 320, 470, 720),
  ('Madinah', 'Al Masa Hotel Madinah', 'Al Haram', '400-500 MTR', 180, 280, 430, 680),
  ('Madinah', 'Le Méridien Madinah', 'Al Haram', '500 MTR', 200, 300, 450, 700),
  ('Madinah', 'Oberoi Madinah', 'Al Haram', '400 MTR', 350, 450, 600, 850),
  ('Madinah', 'Al Eiman Royal Hotel', 'Al Haram', '600-700 MTR', 150, 250, 400, 650),
  ('Madinah', 'Al Rawda Royal Inn', 'Al Haram', '700-800 MTR', 130, 230, 380, 630),
  ('Madinah', 'Dallah Taibah Hotel', 'Al Haram', '1 KM', 120, 220, 370, 620),
  ('Madinah', 'Novotel Madinah', 'Al Haram', '1-2 KM', 110, 210, 360, 610),
  ('Madinah', 'Saja Al Madinah Hotel', 'Al Haram', 'Shuttle Service', 100, 200, 350, 600)
ON CONFLICT (name, city) DO NOTHING;


-- ============================================================
-- SECTION 4: Demo Admin User
--
-- This creates:
--   Email:    demo@umrahdashboard.pk
--   Password: Demo1234
--
-- The UUID is fixed so the staff_users row can reference it.
-- ============================================================

DO $$
DECLARE
  v_user_id UUID := 'a1b2c3d4-0000-0000-0000-000000000001';
BEGIN

  -- Only insert if user does not already exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@umrahdashboard.pk') THEN

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'demo@umrahdashboard.pk',
      crypt('Demo1234', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"Demo Admin"}',
      FALSE,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Register the email identity (required for email/password login)
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'demo@umrahdashboard.pk'),
      'email',
      'demo@umrahdashboard.pk',
      NOW(),
      NOW(),
      NOW()
    );

    -- Create staff profile (Admin with Full Access)
    INSERT INTO staff_users (id, name, username, role, permission, status)
    VALUES (v_user_id, 'Demo Admin', 'demo', 'Admin', 'Full Access', 'Active');

    RAISE NOTICE 'Demo user created: demo@umrahdashboard.pk / Demo1234';
  ELSE
    INSERT INTO staff_users (id, name, username, role, permission, status)
    SELECT u.id, 'Demo Admin', 'demo', 'Admin', 'Full Access', 'Active'
    FROM auth.users u
    WHERE u.email = 'demo@umrahdashboard.pk'
      AND NOT EXISTS (SELECT 1 FROM staff_users s WHERE s.id = u.id);
    RAISE NOTICE 'Demo auth user already exists — staff profile linked if it was missing.';
  END IF;

END $$;
