-- Migration: Scoring rules with integer pts/km values
-- Walk: 20 pts/km
-- Bike: 18 pts/km
-- Electric Bike: 16 pts/km
-- E-Scooter: 13 pts/km
-- Bus: 12 pts/km
-- Carpool: 10 pts/km

INSERT INTO public.scoring_rules (transport_type, points_per_km, active)
VALUES
  ('walking', 20, true),
  ('cycling', 18, true),
  ('electric_bike', 16, true),
  ('e_scooter', 13, true),
  ('bus', 12, true),
  ('carpooling', 10, true)
ON CONFLICT (transport_type) DO UPDATE
  SET points_per_km = EXCLUDED.points_per_km, active = true, updated_at = now();

CREATE OR REPLACE FUNCTION public.log_multi_modal_trip(_segments jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_trip_id uuid := gen_random_uuid();
  seg jsonb;
  seg_type text;
  seg_distance numeric;
  seg_duration numeric;
  seg_speed numeric;
  rate numeric;
  max_speed numeric;
  seg_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to log a trip';
  END IF;

  IF _segments IS NULL OR jsonb_typeof(_segments) <> 'array' THEN
    RAISE EXCEPTION 'Segments must be a JSON array';
  END IF;

  seg_count := jsonb_array_length(_segments);
  IF seg_count = 0 THEN
    RAISE EXCEPTION 'At least one trip segment is required';
  END IF;
  IF seg_count > 10 THEN
    RAISE EXCEPTION 'A trip can have at most 10 segments';
  END IF;

  FOR seg IN SELECT * FROM jsonb_array_elements(_segments)
  LOOP
    seg_type := seg->>'transport_type';
    seg_distance := NULLIF(seg->>'distance_km', '')::numeric;
    seg_duration := NULLIF(seg->>'duration_minutes', '')::numeric;

    IF seg_type IS NULL OR seg_distance IS NULL THEN
      RAISE EXCEPTION 'Each segment requires transport_type and distance_km';
    END IF;

    IF seg_distance <= 0 OR seg_distance > 500 THEN
      RAISE EXCEPTION 'Segment distance_km must be between 0 and 500 (got %)', seg_distance;
    END IF;

    SELECT points_per_km INTO rate
    FROM public.scoring_rules
    WHERE transport_type = seg_type AND active = true;

    IF rate IS NULL THEN
      RAISE EXCEPTION 'Unknown or inactive transport_type: %', seg_type;
    END IF;

    IF seg_duration IS NOT NULL THEN
      IF seg_duration <= 0 OR seg_duration > 1440 THEN
        RAISE EXCEPTION 'Segment duration_minutes must be between 0 and 1440 (got %)', seg_duration;
      END IF;

      seg_speed := seg_distance / (seg_duration / 60.0);

      max_speed := CASE seg_type
        WHEN 'walking'       THEN 10
        WHEN 'cycling'       THEN 45
        WHEN 'electric_bike' THEN 50
        WHEN 'e_scooter'     THEN 40
        WHEN 'bus'           THEN 120
        WHEN 'carpooling'    THEN 140
        ELSE 200
      END;

      IF seg_speed > max_speed THEN
        RAISE EXCEPTION 'Segment speed % km/h exceeds limit of % km/h for %',
          round(seg_speed, 1), max_speed, seg_type;
      END IF;
    END IF;
  END LOOP;

  FOR seg IN SELECT * FROM jsonb_array_elements(_segments)
  LOOP
    INSERT INTO public.activities (user_id, transport_type, distance_km, trip_id)
    VALUES (
      auth.uid(),
      seg->>'transport_type',
      (seg->>'distance_km')::numeric,
      new_trip_id
    );
  END LOOP;

  RETURN new_trip_id;
END;
$$;
