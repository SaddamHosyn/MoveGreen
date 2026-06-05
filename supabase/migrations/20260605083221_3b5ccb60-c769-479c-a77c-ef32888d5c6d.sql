CREATE OR REPLACE FUNCTION public.generate_join_code()
 RETURNS text
 LANGUAGE sql
AS $function$
  SELECT upper(
    substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
    substr(md5(random()::text || clock_timestamp()::text), 6, 4)
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_company_join_code(_company_id uuid, _new_code text)
 RETURNS companies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  normalized text;
  updated_company public.companies;
  is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  normalized := upper(trim(_new_code));

  IF normalized !~ '^[A-Z0-9-]{4,20}$' THEN
    RAISE EXCEPTION 'Invalid code format. Use 4–20 uppercase letters, numbers, or dashes only. Good examples: VIKING-2026, TEAM-42, GREEN-MOBILITY. No spaces or special characters.';
  END IF;

  -- Must be company_admin for THIS company, or platform_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND (
        (role = 'company_admin' AND company_id = _company_id)
        OR role = 'platform_admin'
      )
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Only the company admin can change the join code';
  END IF;

  -- Uniqueness check (friendlier than raw constraint error)
  IF EXISTS (SELECT 1 FROM public.companies WHERE join_code = normalized AND id <> _company_id) THEN
    RAISE EXCEPTION 'That code is already taken by another company';
  END IF;

  UPDATE public.companies SET join_code = normalized
   WHERE id = _company_id
   RETURNING * INTO updated_company;

  RETURN updated_company;
END;
$function$;