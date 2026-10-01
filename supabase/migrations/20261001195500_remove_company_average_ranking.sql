-- Company rankings use total points only. Average points are not part of the API.
DROP FUNCTION IF EXISTS public.get_company_leaderboard(integer, integer);
DROP FUNCTION IF EXISTS public.get_company_by_slug(text);

CREATE FUNCTION public.get_company_leaderboard(
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS TABLE(
  rank bigint,
  company_id uuid,
  name text,
  public_slug text,
  total_points integer,
  member_count bigint,
  active_member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    ROW_NUMBER() OVER (
      ORDER BY COALESCE(c.total_points, 0) DESC, c.name ASC
    ) AS rank,
    c.id AS company_id,
    c.name,
    c.public_slug,
    COALESCE(c.total_points, 0) AS total_points,
    (
      SELECT COUNT(*)
      FROM public.users u
      WHERE u.company_id = c.id
    ) AS member_count,
    (
      SELECT COUNT(*)
      FROM public.users u
      WHERE u.company_id = c.id
        AND EXISTS (
          SELECT 1
          FROM public.activities a
          WHERE a.user_id = u.id
        )
    ) AS active_member_count
  FROM public.companies c
  ORDER BY COALESCE(c.total_points, 0) DESC, c.name ASC
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
$$;

CREATE FUNCTION public.get_company_by_slug(_slug text) RETURNS TABLE(
  company_id uuid,
  name text,
  public_slug text,
  total_points integer,
  global_rank bigint,
  member_count bigint,
  active_member_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    c.id AS company_id,
    c.name,
    c.public_slug,
    COALESCE(c.total_points, 0) AS total_points,
    ranked.global_rank,
    (
      SELECT COUNT(*)
      FROM public.users u
      WHERE u.company_id = c.id
    ) AS member_count,
    (
      SELECT COUNT(*)
      FROM public.users u
      WHERE u.company_id = c.id
        AND EXISTS (
          SELECT 1
          FROM public.activities a
          WHERE a.user_id = u.id
        )
    ) AS active_member_count
  FROM public.companies c
  JOIN (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(total_points, 0) DESC, name ASC
      ) AS global_rank
    FROM public.companies
  ) ranked ON ranked.id = c.id
  WHERE c.public_slug = lower(trim(_slug));
$$;

GRANT EXECUTE ON FUNCTION public.get_company_leaderboard(integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_by_slug(text) TO anon, authenticated;
