-- Store the user-facing transport names as the canonical transport_type values.
UPDATE public.activities
SET transport_type = CASE transport_type
  WHEN 'walking' THEN 'Walk'
  WHEN 'cycling' THEN 'Bike'
  WHEN 'electric_bike' THEN 'Electric Bike'
  WHEN 'e_scooter' THEN 'E-Scooter'
  WHEN 'bus' THEN 'Bus'
  WHEN 'carpooling' THEN 'Carpool'
  ELSE transport_type
END
WHERE transport_type IN ('walking', 'cycling', 'electric_bike', 'e_scooter', 'bus', 'carpooling');

UPDATE public.badges
SET transport_type = CASE transport_type
  WHEN 'walking' THEN 'Walk'
  WHEN 'cycling' THEN 'Bike'
  WHEN 'electric_bike' THEN 'Electric Bike'
  WHEN 'e_scooter' THEN 'E-Scooter'
  WHEN 'bus' THEN 'Bus'
  WHEN 'carpooling' THEN 'Carpool'
  ELSE transport_type
END
WHERE transport_type IN ('walking', 'cycling', 'electric_bike', 'e_scooter', 'bus', 'carpooling');

UPDATE public.scoring_rules
SET transport_type = CASE transport_type
  WHEN 'walking' THEN 'Walk'
  WHEN 'cycling' THEN 'Bike'
  WHEN 'electric_bike' THEN 'Electric Bike'
  WHEN 'e_scooter' THEN 'E-Scooter'
  WHEN 'bus' THEN 'Bus'
  WHEN 'carpooling' THEN 'Carpool'
  ELSE transport_type
END,
updated_at = now()
WHERE transport_type IN ('walking', 'cycling', 'electric_bike', 'e_scooter', 'bus', 'carpooling');

UPDATE public.scoring_rules
SET points_per_km = CASE transport_type
  WHEN 'Walk' THEN 20
  WHEN 'Bike' THEN 18
  WHEN 'Electric Bike' THEN 16
  WHEN 'E-Scooter' THEN 13
  WHEN 'Bus' THEN 12
  WHEN 'Carpool' THEN 10
END,
active = true,
updated_at = now()
WHERE transport_type IN ('Walk', 'Bike', 'Electric Bike', 'E-Scooter', 'Bus', 'Carpool');

CREATE OR REPLACE FUNCTION public.award_badges_after_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := NEW.user_id;
  v_total_points integer;
  v_total_km numeric;
  v_activity_count integer;
  v_walking_km numeric;
  v_cycling_km numeric;
  v_distinct_types integer;
BEGIN
  SELECT COALESCE(total_points, 0) INTO v_total_points
    FROM public.users WHERE id = v_user_id;

  SELECT
    COALESCE(SUM(distance_km), 0),
    COUNT(*),
    COALESCE(SUM(distance_km) FILTER (WHERE transport_type = 'Walk'), 0),
    COALESCE(SUM(distance_km) FILTER (WHERE transport_type = 'Bike'), 0),
    COUNT(DISTINCT transport_type)
  INTO v_total_km, v_activity_count, v_walking_km, v_cycling_km, v_distinct_types
  FROM public.activities WHERE user_id = v_user_id;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'first_move' AND v_activity_count = 1
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = '10km_commuter' AND v_total_km >= 10
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'century_club' AND v_total_points >= 100
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'eco_champion' AND v_total_points >= 500
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'marathon_walker' AND v_walking_km >= 42
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'tour_de_office' AND v_cycling_km >= 50
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'transport_explorer' AND v_distinct_types >= 3
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;
