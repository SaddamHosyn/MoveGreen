
-- 1. Global company leaderboard (public)
CREATE OR REPLACE FUNCTION public.get_company_leaderboard(_limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE (
  rank bigint,
  company_id uuid,
  name text,
  public_slug text,
  total_points integer,
  member_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    RANK() OVER (ORDER BY COALESCE(c.total_points, 0) DESC) AS rank,
    c.id,
    c.name,
    c.public_slug,
    COALESCE(c.total_points, 0),
    (SELECT count(*) FROM public.users u WHERE u.company_id = c.id) AS member_count
  FROM public.companies c
  ORDER BY COALESCE(c.total_points, 0) DESC, c.name ASC
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
$$;

-- 2. Top users overall (public)
CREATE OR REPLACE FUNCTION public.get_top_users(_limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  name text,
  total_points integer,
  company_id uuid,
  company_name text,
  company_slug text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    RANK() OVER (ORDER BY COALESCE(u.total_points, 0) DESC) AS rank,
    u.id,
    u.name,
    COALESCE(u.total_points, 0),
    u.company_id,
    c.name,
    c.public_slug
  FROM public.users u
  LEFT JOIN public.companies c ON c.id = u.company_id
  ORDER BY COALESCE(u.total_points, 0) DESC, u.name ASC
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
$$;

-- 3. Users inside one company (public)
CREATE OR REPLACE FUNCTION public.get_company_user_leaderboard(_company_id uuid, _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE (
  rank bigint,
  user_id uuid,
  name text,
  total_points integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    RANK() OVER (ORDER BY COALESCE(u.total_points, 0) DESC) AS rank,
    u.id,
    u.name,
    COALESCE(u.total_points, 0)
  FROM public.users u
  WHERE u.company_id = _company_id
  ORDER BY COALESCE(u.total_points, 0) DESC, u.name ASC
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
$$;

-- 4. Public company profile by slug
CREATE OR REPLACE FUNCTION public.get_company_by_slug(_slug text)
RETURNS TABLE (
  company_id uuid,
  name text,
  public_slug text,
  total_points integer,
  global_rank bigint,
  member_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      c.id,
      c.name,
      c.public_slug,
      COALESCE(c.total_points, 0) AS total_points,
      RANK() OVER (ORDER BY COALESCE(c.total_points, 0) DESC) AS global_rank
    FROM public.companies c
  )
  SELECT
    r.id,
    r.name,
    r.public_slug,
    r.total_points,
    r.global_rank,
    (SELECT count(*) FROM public.users u WHERE u.company_id = r.id) AS member_count
  FROM ranked r
  WHERE r.public_slug = lower(trim(_slug));
$$;

-- 5. My rank (authenticated)
CREATE OR REPLACE FUNCTION public.get_my_rank()
RETURNS TABLE (
  user_id uuid,
  name text,
  total_points integer,
  global_rank bigint,
  global_total bigint,
  company_id uuid,
  company_name text,
  company_rank bigint,
  company_total bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  RETURN QUERY
  WITH gr AS (
    SELECT u.id, u.name, u.company_id, COALESCE(u.total_points, 0) AS pts,
           RANK() OVER (ORDER BY COALESCE(u.total_points, 0) DESC) AS rk
    FROM public.users u
  ),
  cr AS (
    SELECT u.id, COALESCE(u.total_points, 0) AS pts,
           RANK() OVER (PARTITION BY u.company_id ORDER BY COALESCE(u.total_points, 0) DESC) AS rk,
           count(*) OVER (PARTITION BY u.company_id) AS total
    FROM public.users u
    WHERE u.company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
  )
  SELECT
    gr.id,
    gr.name,
    gr.pts,
    gr.rk,
    (SELECT count(*) FROM public.users),
    gr.company_id,
    c.name,
    cr.rk,
    cr.total
  FROM gr
  LEFT JOIN cr ON cr.id = gr.id
  LEFT JOIN public.companies c ON c.id = gr.company_id
  WHERE gr.id = auth.uid();
END;
$$;

-- Grants: public leaderboards readable by anon + authenticated; my_rank only authenticated
REVOKE ALL ON FUNCTION public.get_company_leaderboard(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_top_users(int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_company_user_leaderboard(uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_company_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_rank() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_company_leaderboard(int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_users(int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_user_leaderboard(uuid, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;
