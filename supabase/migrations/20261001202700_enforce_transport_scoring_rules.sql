-- Enforce the exact transport names and point values used by the application.
-- Re-running this migration is safe.

UPDATE public.activities
SET transport_type = CASE transport_type
  WHEN 'walking' THEN 'Walk'
  WHEN 'Walking' THEN 'Walk'
  WHEN 'cycling' THEN 'Bike'
  WHEN 'Cycling' THEN 'Bike'
  WHEN 'electric_bike' THEN 'Electric Bike'
  WHEN 'e_scooter' THEN 'E-Scooter'
  WHEN 'bus' THEN 'Bus'
  WHEN 'carpooling' THEN 'Carpool'
  WHEN 'Carpooling' THEN 'Carpool'
  ELSE transport_type
END
WHERE transport_type IN (
  'walking', 'Walking', 'cycling', 'Cycling', 'electric_bike',
  'e_scooter', 'bus', 'carpooling', 'Carpooling'
);

UPDATE public.badges
SET transport_type = CASE transport_type
  WHEN 'walking' THEN 'Walk'
  WHEN 'Walking' THEN 'Walk'
  WHEN 'cycling' THEN 'Bike'
  WHEN 'Cycling' THEN 'Bike'
  WHEN 'electric_bike' THEN 'Electric Bike'
  WHEN 'e_scooter' THEN 'E-Scooter'
  WHEN 'bus' THEN 'Bus'
  WHEN 'carpooling' THEN 'Carpool'
  WHEN 'Carpooling' THEN 'Carpool'
  ELSE transport_type
END
WHERE transport_type IN (
  'walking', 'Walking', 'cycling', 'Cycling', 'electric_bike',
  'e_scooter', 'bus', 'carpooling', 'Carpooling'
);

DELETE FROM public.scoring_rules;

INSERT INTO public.scoring_rules (transport_type, points_per_km, active)
VALUES
  ('Walk', 20, true),
  ('Bike', 18, true),
  ('Electric Bike', 16, true),
  ('E-Scooter', 13, true),
  ('Bus', 12, true),
  ('Carpool', 10, true);
