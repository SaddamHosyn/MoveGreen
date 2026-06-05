
-- ============================================================
-- MIGRATION 1: Foundation (roles, scoring, auto-points, totals, RLS hardening)
-- ============================================================

-- 1. ROLES SYSTEM ---------------------------------------------
CREATE TYPE public.app_role AS ENUM ('user', 'company_admin', 'platform_admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security-definer role check (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Platform admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- 2. SCORING RULES --------------------------------------------
CREATE TABLE public.scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_type text NOT NULL UNIQUE,
  points_per_km integer NOT NULL CHECK (points_per_km >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scoring_rules TO anon, authenticated;
GRANT ALL ON public.scoring_rules TO service_role;

ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scoring rules"
  ON public.scoring_rules FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Platform admins manage scoring rules"
  ON public.scoring_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- Seed default rules per project spec
INSERT INTO public.scoring_rules (transport_type, points_per_km) VALUES
  ('walking', 10),
  ('cycling', 8),
  ('bus', 5),
  ('electric_bike', 6);

-- 3. ACTIVITIES HARDENING -------------------------------------
-- Force user_id NOT NULL (RLS check fails open on NULL otherwise)
DELETE FROM public.activities WHERE user_id IS NULL;
ALTER TABLE public.activities ALTER COLUMN user_id SET NOT NULL;

-- Use timestamptz for proper TZ handling
ALTER TABLE public.activities
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

-- Validate distance + auto-compute points SERVER SIDE (prevents cheating)
CREATE OR REPLACE FUNCTION public.calculate_activity_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate integer;
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

  NEW.points_earned := FLOOR(NEW.distance_km * rate);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_calculate_activity_points
  BEFORE INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_activity_points();

-- 4. AUTO-UPDATE TOTAL POINTS ---------------------------------
CREATE OR REPLACE FUNCTION public.update_totals_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_company uuid;
BEGIN
  UPDATE public.users
     SET total_points = COALESCE(total_points, 0) + NEW.points_earned
   WHERE id = NEW.user_id
   RETURNING company_id INTO user_company;

  IF user_company IS NOT NULL THEN
    UPDATE public.companies
       SET total_points = COALESCE(total_points, 0) + NEW.points_earned
     WHERE id = user_company;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_totals_on_activity
  AFTER INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_totals_on_activity();

-- 5. RLS HARDENING --------------------------------------------
-- badges: was exposed with no RLS
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT ALL ON public.badges TO service_role;

CREATE POLICY "Anyone can view badges"
  ON public.badges FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Platform admins manage badges"
  ON public.badges FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

-- user_badges: was exposed with no RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;

CREATE POLICY "Anyone can view user badges"
  ON public.user_badges FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service_role / triggers / n8n (using service key) can award badges.
-- No INSERT/UPDATE/DELETE policy for normal users — they cannot self-award.

-- Tighten activities public exposure: drop full public SELECT,
-- public dashboard should read from leaderboard VIEWS not raw activities.
DROP POLICY IF EXISTS "Public can view activities" ON public.activities;

-- Tighten users: drop the broad public SELECT.
-- Public leaderboards read from views (company_leaderboard / intra_company_leaderboard).
DROP POLICY IF EXISTS "Public can view users" ON public.users;

-- 6. INDEXES FOR LEADERBOARD PERFORMANCE ----------------------
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_company_points ON public.users(company_id, total_points DESC);
CREATE INDEX IF NOT EXISTS idx_companies_points ON public.companies(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
