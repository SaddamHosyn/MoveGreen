-- Rebuild company totals from the users table before ranking.
-- This removes stale company totals from the ranking source.
UPDATE public.companies c
SET total_points = COALESCE(
  (
    SELECT SUM(COALESCE(u.total_points, 0))::integer
    FROM public.users u
    WHERE u.company_id = c.id
  ),
  0
);

DROP FUNCTION IF EXISTS public.get_company_leaderboard(integer, integer);

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
  WITH company_totals AS (
    SELECT
      c.id,
      c.name,
      c.public_slug,
      COALESCE(SUM(COALESCE(u.total_points, 0)), 0)::integer AS total_points,
      COUNT(u.id)::bigint AS member_count,
      COUNT(u.id) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM public.activities a
          WHERE a.user_id = u.id
        )
      )::bigint AS active_member_count
    FROM public.companies c
    LEFT JOIN public.users u ON u.company_id = c.id
    GROUP BY c.id, c.name, c.public_slug
  ),
  ranked AS (
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY total_points DESC, name ASC
      ) AS rank,
      company_totals.*
    FROM company_totals
  )
  SELECT rank, id, name, public_slug, total_points, member_count, active_member_count
  FROM ranked
  ORDER BY rank
  LIMIT GREATEST(1, LEAST(_limit, 200))
  OFFSET GREATEST(0, _offset);
$$;

GRANT EXECUTE ON FUNCTION public.get_company_leaderboard(integer, integer) TO anon, authenticated;
