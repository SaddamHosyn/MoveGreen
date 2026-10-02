-- ============================================================
-- FIX ALL: Remove Saadi + Recalculate all points fresh
-- ============================================================

-- STEP 1: Delete Saadi and all related data
DO $$
DECLARE
  saadi_id uuid;
BEGIN
  SELECT id INTO saadi_id FROM public.users WHERE lower(name) LIKE '%saadi%' LIMIT 1;
  IF saadi_id IS NOT NULL THEN
    DELETE FROM public.user_badges WHERE user_id = saadi_id;
    DELETE FROM public.user_roles WHERE user_id = saadi_id;
    DELETE FROM public.activities WHERE user_id = saadi_id;
    DELETE FROM public.users WHERE id = saadi_id;
    DELETE FROM auth.users WHERE id = saadi_id;
  END IF;
END $$;

-- Also remove any Saadi company if still exists
DELETE FROM public.companies WHERE lower(name) LIKE '%saadi%' OR lower(name) LIKE '%saad%';

-- STEP 2: Fix ALL activities — set points_earned using inline CASE (no scoring_rules dependency)
UPDATE public.activities
SET points_earned = GREATEST(1, ROUND(distance_km * (
  CASE lower(trim(transport_type))
    WHEN 'walking'       THEN 2.0
    WHEN 'walk'          THEN 2.0
    WHEN 'cycling'       THEN 1.5
    WHEN 'bike'          THEN 1.5
    WHEN 'electric_bike' THEN 1.2
    WHEN 'electric bike' THEN 1.2
    WHEN 'e_scooter'     THEN 1.3
    WHEN 'e-scooter'     THEN 1.3
    WHEN 'bus'           THEN 1.0
    WHEN 'carpooling'    THEN 0.5
    WHEN 'carpool'       THEN 0.5
    ELSE 1.0
  END
)));

-- STEP 3: Recalculate ALL users.total_points from scratch
UPDATE public.users u
SET total_points = COALESCE((
  SELECT SUM(a.points_earned)
  FROM public.activities a
  WHERE a.user_id = u.id
), 0);

-- STEP 4: Recalculate ALL companies.total_points from user totals
UPDATE public.companies c
SET total_points = COALESCE((
  SELECT SUM(u.total_points)
  FROM public.users u
  WHERE u.company_id = c.id
), 0);

-- STEP 5: Drop all old triggers and recreate them cleanly
DROP TRIGGER IF EXISTS trg_calculate_activity_points ON public.activities;
DROP TRIGGER IF EXISTS calc_activity_points ON public.activities;
DROP TRIGGER IF EXISTS trg_update_totals_on_activity ON public.activities;
DROP TRIGGER IF EXISTS update_totals_after_activity ON public.activities;

CREATE OR REPLACE FUNCTION public.calculate_activity_points()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.distance_km <= 0 OR NEW.distance_km > 500 THEN
    RAISE EXCEPTION 'distance_km must be between 0 and 500';
  END IF;
  NEW.points_earned := GREATEST(1, ROUND(NEW.distance_km * (
    CASE lower(trim(NEW.transport_type))
      WHEN 'walking'       THEN 2.0
      WHEN 'walk'          THEN 2.0
      WHEN 'cycling'       THEN 1.5
      WHEN 'bike'          THEN 1.5
      WHEN 'electric_bike' THEN 1.2
      WHEN 'electric bike' THEN 1.2
      WHEN 'e_scooter'     THEN 1.3
      WHEN 'e-scooter'     THEN 1.3
      WHEN 'bus'           THEN 1.0
      WHEN 'carpooling'    THEN 0.5
      WHEN 'carpool'       THEN 0.5
      ELSE 1.0
    END
  )));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_activity_points
  BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.calculate_activity_points();

CREATE OR REPLACE FUNCTION public.update_totals_on_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_company_id uuid;
BEGIN
  UPDATE public.users
  SET total_points = COALESCE(total_points, 0) + COALESCE(NEW.points_earned, 0)
  WHERE id = NEW.user_id
  RETURNING company_id INTO v_company_id;

  IF v_company_id IS NOT NULL THEN
    UPDATE public.companies
    SET total_points = COALESCE(total_points, 0) + COALESCE(NEW.points_earned, 0)
    WHERE id = v_company_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_totals_on_activity
  AFTER INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_totals_on_activity();

-- STEP 6: Show final results
SELECT name, total_points FROM public.users WHERE lower(name) NOT LIKE '%saadi%' ORDER BY total_points DESC;
