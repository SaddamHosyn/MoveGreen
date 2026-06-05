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
  WITH current_user_company AS (
    SELECT usr.company_id
    FROM public.users AS usr
    WHERE usr.id = auth.uid()
  ),
  gr AS (
    SELECT
      usr.id,
      usr.name,
      usr.company_id,
      COALESCE(usr.total_points, 0) AS pts,
      RANK() OVER (ORDER BY COALESCE(usr.total_points, 0) DESC) AS rk
    FROM public.users AS usr
  ),
  cr AS (
    SELECT
      usr.id,
      COALESCE(usr.total_points, 0) AS pts,
      RANK() OVER (PARTITION BY usr.company_id ORDER BY COALESCE(usr.total_points, 0) DESC) AS rk,
      count(*) OVER (PARTITION BY usr.company_id) AS total
    FROM public.users AS usr
    WHERE usr.company_id = (SELECT cuc.company_id FROM current_user_company AS cuc)
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
  LEFT JOIN public.companies AS c ON c.id = gr.company_id
  WHERE gr.id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_rank() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_rank() TO authenticated;