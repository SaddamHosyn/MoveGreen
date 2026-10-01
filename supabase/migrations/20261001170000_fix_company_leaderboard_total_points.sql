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
   active_member_count bigint,
   avg_points numeric
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$ WITH active AS (
      SELECT u.company_id,
         COUNT(*) AS active_count,
         COALESCE(SUM(u.total_points), 0) AS active_points
      FROM public.users u
      WHERE u.company_id IS NOT NULL
         AND EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.user_id = u.id
         )
      GROUP BY u.company_id
   )
SELECT ROW_NUMBER() OVER (
      ORDER BY COALESCE(c.total_points, 0) DESC,
         c.name ASC
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
   COALESCE(a.active_count, 0) AS active_member_count,
   ROUND(
      CASE
         WHEN COALESCE(a.active_count, 0) = 0 THEN 0
         ELSE a.active_points::numeric / a.active_count
      END,
      1
   ) AS avg_points
FROM public.companies c
   LEFT JOIN active a ON a.company_id = c.id
ORDER BY COALESCE(c.total_points, 0) DESC,
   c.name ASC
LIMIT GREATEST(1, LEAST(_limit, 200)) OFFSET GREATEST(0, _offset);
$$;
CREATE FUNCTION public.get_company_by_slug(_slug text) RETURNS TABLE(
   company_id uuid,
   name text,
   public_slug text,
   total_points integer,
   global_rank bigint,
   member_count bigint,
   active_member_count bigint,
   avg_points numeric
) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$ WITH active AS (
      SELECT u.company_id,
         COUNT(*) AS active_count,
         COALESCE(SUM(u.total_points), 0) AS active_points
      FROM public.users u
      WHERE u.company_id IS NOT NULL
         AND EXISTS (
            SELECT 1
            FROM public.activities a
            WHERE a.user_id = u.id
         )
      GROUP BY u.company_id
   ),
   ranked AS (
      SELECT c.id,
         c.name,
         c.public_slug,
         COALESCE(c.total_points, 0) AS total_points,
         COALESCE(a.active_count, 0) AS active_count,
         CASE
            WHEN COALESCE(a.active_count, 0) = 0 THEN 0
            ELSE a.active_points::numeric / a.active_count
         END AS avg_pts,
         ROW_NUMBER() OVER (
            ORDER BY COALESCE(c.total_points, 0) DESC,
               c.name ASC
         ) AS global_rank
      FROM public.companies c
         LEFT JOIN active a ON a.company_id = c.id
   )
SELECT r.id AS company_id,
   r.name,
   r.public_slug,
   r.total_points,
   r.global_rank,
   (
      SELECT COUNT(*)
      FROM public.users u
      WHERE u.company_id = r.id
   ) AS member_count,
   r.active_count AS active_member_count,
   ROUND(r.avg_pts, 1) AS avg_points
FROM ranked r
WHERE r.public_slug = lower(trim(_slug));
$$;
GRANT EXECUTE ON FUNCTION public.get_company_leaderboard(integer, integer) TO anon,
   authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_by_slug(text) TO anon,
   authenticated;
