-- Public RPC: aggregate platform-wide activity stats (no auth required)
-- Returns total trips, distance, CO2, and per-mode breakdown for all users

CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_trips',    COUNT(*),
    'total_km',       ROUND(SUM(distance_km)::numeric, 2),
    'total_points',   SUM(points_earned),
    'total_co2_kg',   ROUND((SUM(distance_km) * 0.129)::numeric, 2),
    'by_mode',        jsonb_agg(
      jsonb_build_object(
        'transport_type', transport_type,
        'trip_count',     trip_count,
        'total_km',       ROUND(total_km::numeric, 2),
        'co2_kg',         ROUND((total_km * 0.129)::numeric, 2)
      )
    )
  )
  INTO result
  FROM (
    SELECT
      SUM(distance_km)   AS total_km,
      SUM(distance_km)   AS _ignore,
      COUNT(*)           AS trip_count,
      transport_type
    FROM public.activities
    GROUP BY transport_type
  ) sub,
  LATERAL (SELECT COUNT(*) AS total_trips, SUM(distance_km) AS total_km_all, SUM(points_earned) AS total_points FROM public.activities) agg;

  -- Simpler approach: build it step by step
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

-- Allow anonymous access
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;
