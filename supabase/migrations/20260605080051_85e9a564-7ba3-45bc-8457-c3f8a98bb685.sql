
-- =========================================================
-- 1. FIX handle_new_user (was referencing dropped column)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, company_id, total_points)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1), 'New User'),
    NULL,
    0
  )
  ON CONFLICT (id) DO NOTHING;

  -- Every new user gets the default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger on auth.users exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 2. ATTACH activity triggers (functions existed but no triggers!)
-- =========================================================
DROP TRIGGER IF EXISTS calc_activity_points ON public.activities;
CREATE TRIGGER calc_activity_points
BEFORE INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.calculate_activity_points();

DROP TRIGGER IF EXISTS update_totals_after_activity ON public.activities;
CREATE TRIGGER update_totals_after_activity
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.update_totals_on_activity();

-- =========================================================
-- 3. SCHEMA: add updated_at on users + transport_type on badges
-- =========================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.badges
  ADD COLUMN IF NOT EXISTS transport_type text;  -- NULL = any transport

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 4. PERFORMANCE indexes
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_activities_created_at
  ON public.activities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_created
  ON public.activities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_company_points
  ON public.users (company_id, total_points DESC);

-- =========================================================
-- 5. VALIDATION: no future-dated activities
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.created_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Activity cannot be dated in the future';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_activity_trigger ON public.activities;
CREATE TRIGGER validate_activity_trigger
BEFORE INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.validate_activity();

-- =========================================================
-- 6. BADGE AUTO-AWARD (replaces n8n Badge Assignment workflow)
-- =========================================================
CREATE OR REPLACE FUNCTION public.award_badges_after_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Award any badge whose threshold the user has now reached.
  -- For transport-specific badges, sum only that transport's distance.
  -- For generic badges (transport_type IS NULL), sum all distance.
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT NEW.user_id, b.id
  FROM public.badges b
  WHERE b.threshold_km IS NOT NULL
    AND (
      b.transport_type IS NULL
      OR b.transport_type = NEW.transport_type
    )
    AND (
      SELECT COALESCE(SUM(a.distance_km), 0)
      FROM public.activities a
      WHERE a.user_id = NEW.user_id
        AND (b.transport_type IS NULL OR a.transport_type = b.transport_type)
    ) >= b.threshold_km
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure unique constraint exists for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_badges_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_badges_user_badge_unique'
  ) THEN
    ALTER TABLE public.user_badges
      ADD CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS award_badges_trigger ON public.activities;
CREATE TRIGGER award_badges_trigger
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.award_badges_after_activity();

-- Allow the trigger (which runs as the user) to insert into user_badges
DROP POLICY IF EXISTS "System awards badges" ON public.user_badges;
CREATE POLICY "System awards badges" ON public.user_badges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 7. SEED default badges (idempotent)
-- =========================================================
INSERT INTO public.badges (name, description, threshold_km, transport_type) VALUES
  ('First Steps',     'Logged your first walk',            1,   'walking'),
  ('10km Walker',     'Walked 10 km in total',             10,  'walking'),
  ('100km Walker',    'Walked 100 km in total',            100, 'walking'),
  ('First Ride',      'Logged your first cycling trip',    1,   'cycling'),
  ('100km Cyclist',   'Cycled 100 km in total',            100, 'cycling'),
  ('Bus Commuter',    'Took the bus for 50 km in total',   50,  'bus'),
  ('E-Bike Explorer', 'Rode an e-bike for 50 km in total', 50,  'electric_bike'),
  ('Green Commuter',  'Logged 500 km of green transport',  500, NULL)
ON CONFLICT DO NOTHING;
