-- Replace bus/private transport with vehicle-specific rates (CAR, H1, STARIA, GMC, HIACE, COASTER)

ALTER TABLE transport_rates DROP CONSTRAINT IF EXISTS transport_rates_type_check;

DELETE FROM transport_rates;

INSERT INTO transport_rates (type, pax_count, rate_sar) VALUES
  ('CAR', 1, 450), ('CAR', 2, 430), ('CAR', 3, 410), ('CAR', 4, 390),
  ('H1', 1, 550), ('H1', 2, 520), ('H1', 3, 490), ('H1', 4, 460),
  ('STARIA', 1, 600), ('STARIA', 2, 570), ('STARIA', 3, 540), ('STARIA', 4, 510),
  ('GMC', 1, 700), ('GMC', 2, 670), ('GMC', 3, 640), ('GMC', 4, 610),
  ('HIACE', 1, 800), ('HIACE', 2, 760), ('HIACE', 3, 720), ('HIACE', 4, 680),
  ('COASTER', 1, 1200), ('COASTER', 2, 1100), ('COASTER', 3, 1000), ('COASTER', 4, 900);

ALTER TABLE transport_rates ADD CONSTRAINT transport_rates_type_check
  CHECK (type IN ('CAR', 'H1', 'STARIA', 'GMC', 'HIACE', 'COASTER'));

INSERT INTO invoice_services (name) VALUES
  ('Transport — CAR'),
  ('Transport — H1'),
  ('Transport — STARIA'),
  ('Transport — GMC'),
  ('Transport — HIACE'),
  ('Transport — COASTER')
ON CONFLICT (name) DO NOTHING;
