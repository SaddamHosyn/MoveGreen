-- 1. Create the get_platform_stats RPC so public analytics work
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH mode_stats AS (
    SELECT
      transport_type,
      COUNT(*)::int                         AS trip_count,
      COALESCE(SUM(distance_km), 0)         AS total_km
    FROM public.activities
    GROUP BY transport_type
  ),
  totals AS (
    SELECT
      COUNT(*)::int                         AS total_trips,
      COALESCE(SUM(distance_km), 0)         AS total_km,
      COALESCE(SUM(points_earned), 0)::int  AS total_points
    FROM public.activities
  )
  SELECT jsonb_build_object(
    'total_trips',  t.total_trips,
    'total_km',     ROUND(t.total_km::numeric, 2),
    'total_points', t.total_points,
    'total_co2_kg', ROUND((t.total_km * 0.129)::numeric, 2),
    'by_mode',      COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'transport_type', m.transport_type,
          'trip_count',     m.trip_count,
          'total_km',       ROUND(m.total_km::numeric, 2),
          'co2_kg',         ROUND((m.total_km * 0.129)::numeric, 2)
        ) ORDER BY m.total_km DESC
      ) FROM mode_stats m),
      '[]'::jsonb
    )
  )
  INTO result
  FROM totals t;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;

-- 2. Alter scoring_rules to support decimals (numeric) instead of integer
ALTER TABLE public.scoring_rules ALTER COLUMN points_per_km TYPE numeric(10, 2);

-- 3. Fix the trigger function to use numeric so points calculate correctly
CREATE OR REPLACE FUNCTION public.calculate_activity_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate numeric(10, 2);
BEGIN
  IF NEW.distance_km <= 0 OR NEW.distance_km > 500 THEN
    RAISE EXCEPTION 'distance_km must be between 0 and 500';
  END IF;

  SELECT points_per_km INTO rate
  FROM public.scoring_rules
  WHERE transport_type = NEW.transport_type AND active = true;

  IF rate IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive transport_type: %', NEW.transport_type;
  END IF;

  -- Use ROUND instead of FLOOR for better precision with decimals
  NEW.points_earned := ROUND(NEW.distance_km * rate);
  RETURN NEW;
END;
$$;

-- 4. Re-insert the exact decimal rules requested
DELETE FROM public.scoring_rules;

INSERT INTO public.scoring_rules (transport_type, points_per_km, active)
VALUES
  ('Walk', 20, true),
  ('Bike', 18, true),
  ('Electric Bike', 16, true),
  ('E-Scooter', 13, true),
  ('Bus', 12, true),
  ('Carpool', 10, true);
