CREATE OR REPLACE FUNCTION public.claim_company_admin()
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_company_id uuid;
  existing_admin boolean;
  new_role public.user_roles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  -- Get the user's current company
  SELECT company_id INTO user_company_id
  FROM public.users
  WHERE id = auth.uid();

  IF user_company_id IS NULL THEN
    RAISE EXCEPTION 'You must join a company first before claiming admin';
  END IF;

  -- Check if the company already has a company_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE company_id = user_company_id
      AND role = 'company_admin'
  ) INTO existing_admin;

  IF existing_admin THEN
    RAISE EXCEPTION 'This company already has an admin';
  END IF;

  -- Insert the company_admin role for this user
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (auth.uid(), 'company_admin', user_company_id)
  RETURNING * INTO new_role;

  RETURN new_role;
END;
$function$;
