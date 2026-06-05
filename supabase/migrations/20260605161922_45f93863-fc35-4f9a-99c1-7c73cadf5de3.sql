
-- Drop duplicate triggers (keep one of each)
DROP TRIGGER IF EXISTS update_totals_after_activity ON public.activities;
DROP TRIGGER IF EXISTS trg_calculate_activity_points ON public.activities;

-- Recompute user totals from actual activity data
UPDATE public.users u
SET total_points = COALESCE(sub.s, 0)
FROM (
  SELECT user_id, SUM(points_earned)::int AS s
  FROM public.activities
  GROUP BY user_id
) sub
WHERE u.id = sub.user_id;

-- Zero out users with no activities
UPDATE public.users SET total_points = 0
WHERE id NOT IN (SELECT DISTINCT user_id FROM public.activities);

-- Recompute company totals
UPDATE public.companies c
SET total_points = COALESCE(sub.s, 0)
FROM (
  SELECT u.company_id, SUM(u.total_points)::int AS s
  FROM public.users u
  WHERE u.company_id IS NOT NULL
  GROUP BY u.company_id
) sub
WHERE c.id = sub.company_id;

UPDATE public.companies SET total_points = 0
WHERE id NOT IN (SELECT DISTINCT company_id FROM public.users WHERE company_id IS NOT NULL);
