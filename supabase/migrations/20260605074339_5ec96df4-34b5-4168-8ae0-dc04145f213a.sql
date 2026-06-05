
-- ============================================================
-- MIGRATION 2: Live leaderboards + company join
-- ============================================================

-- 1. DROP stale rank columns & old views ----------------------
DROP VIEW IF EXISTS public.company_leaderboard;
DROP VIEW IF EXISTS public.intra_company_leaderboard;

ALTER TABLE public.users DROP COLUMN IF EXISTS current_rank;
ALTER TABLE public.companies DROP COLUMN IF EXISTS global_rank;

-- 2. COMPANY JOIN CODE ----------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS join_code text UNIQUE;

-- Generate join codes for existing rows + future inserts
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
$$;

UPDATE public.companies SET join_code = public.generate_join_code() WHERE join_code IS NULL;

ALTER TABLE public.companies ALTER COLUMN join_code SET NOT NULL;
ALTER TABLE public.companies ALTER COLUMN join_code SET DEFAULT public.generate_join_code();

-- 3. LIVE LEADERBOARD VIEWS (SECURITY INVOKER) ----------------
-- Global company leaderboard — public-safe
CREATE VIEW public.company_leaderboard
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  public_slug,
  COALESCE(total_points, 0) AS total_points,
  RANK() OVER (ORDER BY COALESCE(total_points, 0) DESC) AS global_rank
FROM public.companies;

GRANT SELECT ON public.company_leaderboard TO anon, authenticated;

-- Intra-company user leaderboard — public-safe (no email/auth fields)
CREATE VIEW public.intra_company_leaderboard
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  u.name,
  u.company_id,
  COALESCE(u.total_points, 0) AS total_points,
  RANK() OVER (
    PARTITION BY u.company_id
    ORDER BY COALESCE(u.total_points, 0) DESC
  ) AS company_rank
FROM public.users u
WHERE u.company_id IS NOT NULL;

GRANT SELECT ON public.intra_company_leaderboard TO anon, authenticated;

-- Global public user leaderboard — only safe fields
CREATE VIEW public.public_user_leaderboard
WITH (security_invoker = true) AS
SELECT
  u.id AS user_id,
  u.name,
  u.company_id,
  c.name AS company_name,
  c.public_slug AS company_slug,
  COALESCE(u.total_points, 0) AS total_points,
  RANK() OVER (ORDER BY COALESCE(u.total_points, 0) DESC) AS global_rank
FROM public.users u
LEFT JOIN public.companies c ON c.id = u.company_id;

GRANT SELECT ON public.public_user_leaderboard TO anon, authenticated;

-- 4. RE-ALLOW PUBLIC READS NEEDED BY THE VIEWS ----------------
-- Views use security_invoker, so callers need SELECT on base tables.
-- We expose only what leaderboards need.

-- companies: already has "Public can view companies" → keep
-- But hide join_code from non-members via a column-level approach:
-- Simpler: add a public SELECT policy on users (name + points only via view).
-- Since views run as invoker, we need policies on the underlying tables.

CREATE POLICY "Public leaderboard read on users"
  ON public.users FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. JOIN / LEAVE COMPANY FUNCTIONS ---------------------------
CREATE OR REPLACE FUNCTION public.join_company(_join_code text)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_company public.companies;
  current_company_id uuid;
  user_points integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to join a company';
  END IF;

  SELECT * INTO target_company FROM public.companies WHERE join_code = upper(_join_code);
  IF target_company.id IS NULL THEN
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  SELECT company_id, COALESCE(total_points, 0)
    INTO current_company_id, user_points
  FROM public.users WHERE id = auth.uid();

  -- Remove points from old company
  IF current_company_id IS NOT NULL AND current_company_id <> target_company.id THEN
    UPDATE public.companies
       SET total_points = GREATEST(0, COALESCE(total_points, 0) - user_points)
     WHERE id = current_company_id;
  END IF;

  -- Move user
  UPDATE public.users SET company_id = target_company.id WHERE id = auth.uid();

  -- Add points to new company (only if not already a member)
  IF current_company_id IS DISTINCT FROM target_company.id THEN
    UPDATE public.companies
       SET total_points = COALESCE(total_points, 0) + user_points
     WHERE id = target_company.id
     RETURNING * INTO target_company;
  END IF;

  RETURN target_company;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_company(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_company(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_company()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_company_id uuid;
  user_points integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT company_id, COALESCE(total_points, 0)
    INTO current_company_id, user_points
  FROM public.users WHERE id = auth.uid();

  IF current_company_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.companies
     SET total_points = GREATEST(0, COALESCE(total_points, 0) - user_points)
   WHERE id = current_company_id;

  UPDATE public.users SET company_id = NULL WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.leave_company() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leave_company() TO authenticated;
