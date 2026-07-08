-- Dynamic route-based transport matrix pricing tables

CREATE TABLE IF NOT EXISTS transport_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transport_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_vehicle_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES transport_routes(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES transport_vehicles(id) ON DELETE CASCADE,
  rate_sar NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_route_vehicle UNIQUE (route_id, vehicle_id)
);

-- Enable RLS and create policies
ALTER TABLE transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_vehicle_rates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_routes' AND policyname = 'auth_all'
  ) THEN
    CREATE POLICY "auth_all" ON transport_routes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'transport_vehicles' AND policyname = 'auth_all'
  ) THEN
    CREATE POLICY "auth_all" ON transport_vehicles FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'route_vehicle_rates' AND policyname = 'auth_all'
  ) THEN
    CREATE POLICY "auth_all" ON route_vehicle_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON TABLE public.transport_routes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.transport_vehicles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.route_vehicle_rates TO anon, authenticated, service_role;

-- Seed vehicles
INSERT INTO transport_vehicles (name, sort_order) VALUES
  ('CAR', 1),
  ('H1', 2),
  ('STARIA', 3),
  ('GMC', 4),
  ('HIACE', 5),
  ('COASTER', 6)
ON CONFLICT (name) DO NOTHING;

-- Seed routes
INSERT INTO transport_routes (name, sort_order) VALUES
  ('JED TO MAK', 1),
  ('MAK TO JED', 2),
  ('MAK TO MED / MED TO MAK', 3),
  ('MAK ZIYARAT', 4),
  ('MED ZIYARAT', 5),
  ('MED HTL TO MED APT', 6),
  ('MED HTL TO JED APT', 7)
ON CONFLICT (name) DO NOTHING;

-- Seed rates matrix
DO $$
DECLARE
  v_car UUID; v_h1 UUID; v_staria UUID; v_gmc UUID; v_hiace UUID; v_coaster UUID;
  r_jed_mak UUID; r_mak_jed UUID; r_mak_med UUID; r_mak_ziy UUID; r_med_ziy UUID; r_med_apt UUID; r_med_jed UUID;
BEGIN
  SELECT id INTO v_car FROM transport_vehicles WHERE name = 'CAR';
  SELECT id INTO v_h1 FROM transport_vehicles WHERE name = 'H1';
  SELECT id INTO v_staria FROM transport_vehicles WHERE name = 'STARIA';
  SELECT id INTO v_gmc FROM transport_vehicles WHERE name = 'GMC';
  SELECT id INTO v_hiace FROM transport_vehicles WHERE name = 'HIACE';
  SELECT id INTO v_coaster FROM transport_vehicles WHERE name = 'COASTER';

  SELECT id INTO r_jed_mak FROM transport_routes WHERE name = 'JED TO MAK';
  SELECT id INTO r_mak_jed FROM transport_routes WHERE name = 'MAK TO JED';
  SELECT id INTO r_mak_med FROM transport_routes WHERE name = 'MAK TO MED / MED TO MAK';
  SELECT id INTO r_mak_ziy FROM transport_routes WHERE name = 'MAK ZIYARAT';
  SELECT id INTO r_med_ziy FROM transport_routes WHERE name = 'MED ZIYARAT';
  SELECT id INTO r_med_apt FROM transport_routes WHERE name = 'MED HTL TO MED APT';
  SELECT id INTO r_med_jed FROM transport_routes WHERE name = 'MED HTL TO JED APT';

  -- JED TO MAK
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_jed_mak, v_car, 230) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_jed_mak, v_h1, 280) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_jed_mak, v_staria, 280) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_jed_mak, v_gmc, 430) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_jed_mak, v_hiace, 330) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_jed_mak, v_coaster, 530) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;

  -- MAK TO JED
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_jed, v_car, 180) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_jed, v_h1, 230) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_jed, v_staria, 230) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_jed, v_gmc, 380) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_jed, v_hiace, 280) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_jed, v_coaster, 455) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;

  -- MAK TO MED / MED TO MAK
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_med, v_car, 365) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_med, v_h1, 455) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_med, v_staria, 455) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_med, v_gmc, 930) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_med, v_hiace, 555) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_med, v_coaster, 855) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;

  -- MAK ZIYARAT
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_ziy, v_car, 180) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_ziy, v_h1, 230) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_ziy, v_staria, 230) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_ziy, v_gmc, 380) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_ziy, v_hiace, 330) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_mak_ziy, v_coaster, 405) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;

  -- MED ZIYARAT
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_ziy, v_car, 180) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_ziy, v_h1, 230) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_ziy, v_staria, 230) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_ziy, v_gmc, 380) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_ziy, v_hiace, 330) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_ziy, v_coaster, 405) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;

  -- MED HTL TO MED APT
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_apt, v_car, 130) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_apt, v_h1, 130) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_apt, v_staria, 130) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_apt, v_gmc, 330) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_apt, v_hiace, 180) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_apt, v_coaster, 305) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;

  -- MED HTL TO JED APT
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_jed, v_car, 330) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_jed, v_h1, 405) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_jed, v_staria, 405) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_jed, v_gmc, 830) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_jed, v_hiace, 505) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
  INSERT INTO route_vehicle_rates (route_id, vehicle_id, rate_sar) VALUES (r_med_jed, v_coaster, 805) ON CONFLICT ON CONSTRAINT unique_route_vehicle DO UPDATE SET rate_sar = EXCLUDED.rate_sar;
END $$;
