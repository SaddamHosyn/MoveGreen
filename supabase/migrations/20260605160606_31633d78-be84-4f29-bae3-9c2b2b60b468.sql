
-- 1. Add trip_id column to group segments of a single journey
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS trip_id uuid;

CREATE INDEX IF NOT EXISTS activities_trip_id_idx ON public.activities(trip_id);

-- 2. RPC to log a multi-modal trip atomically
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

  -- Validate every segment first (atomic: function runs in a single tx)
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

    -- Speed-limit sanity check when duration is provided
    IF seg_duration IS NOT NULL THEN
      IF seg_duration <= 0 OR seg_duration > 1440 THEN
        RAISE EXCEPTION 'Segment duration_minutes must be between 0 and 1440 (got %)', seg_duration;
      END IF;

      seg_speed := seg_distance / (seg_duration / 60.0); -- km/h

      max_speed := CASE seg_type
        WHEN 'walking'       THEN 10
        WHEN 'cycling'       THEN 45
        WHEN 'electric_bike' THEN 50
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

  -- All segments valid → insert them sharing the same trip_id
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

GRANT EXECUTE ON FUNCTION public.log_multi_modal_trip(jsonb) TO authenticated;
