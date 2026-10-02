-- Remove 'saadi' company and related user & activity data
CREATE OR REPLACE FUNCTION public.cleanup_saadi_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete activities created by user saadi
  DELETE FROM public.activities 
  WHERE user_id IN (SELECT id FROM public.users WHERE name ILIKE '%saadi%');

  -- Delete activities associated with company saadi
  DELETE FROM public.activities 
  WHERE company_id IN (SELECT id FROM public.companies WHERE name ILIKE '%saadi%');

  -- Unlink users from saadi company
  UPDATE public.users 
  SET company_id = NULL 
  WHERE company_id IN (SELECT id FROM public.companies WHERE name ILIKE '%saadi%');

  -- Delete user saadi
  DELETE FROM public.users 
  WHERE name ILIKE '%saadi%';

  -- Delete company saadi
  DELETE FROM public.companies 
  WHERE name ILIKE '%saadi%' OR public_slug ILIKE '%saadi%';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_saadi_data() TO anon, authenticated;
