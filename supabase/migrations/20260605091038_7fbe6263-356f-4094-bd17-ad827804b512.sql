
-- 1. Add new columns
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allowed_email_domain text;

-- 2. Remove old insecure claim function
DROP FUNCTION IF EXISTS public.claim_company_admin();

-- 3. Atomic create_company: caller becomes the company_admin
CREATE OR REPLACE FUNCTION public.create_company(
  _name text,
  _public_slug text,
  _allowed_email_domain text DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company public.companies;
  caller_email text;
  caller_domain text;
  normalized_slug text;
  normalized_domain text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to create a company';
  END IF;

  IF _name IS NULL OR length(trim(_name)) < 2 THEN
    RAISE EXCEPTION 'Company name must be at least 2 characters';
  END IF;

  normalized_slug := lower(trim(_public_slug));
  IF normalized_slug !~ '^[a-z0-9-]{2,40}$' THEN
    RAISE EXCEPTION 'Slug must be 2-40 lowercase letters, numbers, or dashes';
  END IF;

  -- Optional domain: validate + enforce caller belongs to it
  IF _allowed_email_domain IS NOT NULL AND length(trim(_allowed_email_domain)) > 0 THEN
    normalized_domain := lower(trim(_allowed_email_domain));
    IF normalized_domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid email domain format (e.g. google.com)';
    END IF;

    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    caller_domain := lower(split_part(caller_email, '@', 2));

    IF caller_domain <> normalized_domain THEN
      RAISE EXCEPTION 'You can only create a company for your own email domain (%). Your email is @%.',
        normalized_domain, caller_domain;
    END IF;
  END IF;

  -- Slug uniqueness
  IF EXISTS (SELECT 1 FROM public.companies WHERE public_slug = normalized_slug) THEN
    RAISE EXCEPTION 'That slug is already taken';
  END IF;

  -- Create the company
  INSERT INTO public.companies (name, public_slug, created_by, allowed_email_domain)
  VALUES (trim(_name), normalized_slug, auth.uid(), normalized_domain)
  RETURNING * INTO new_company;

  -- Make caller a member of this company
  UPDATE public.users SET company_id = new_company.id WHERE id = auth.uid();

  -- Make caller the company_admin (atomic)
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (auth.uid(), 'company_admin', new_company.id);

  RETURN new_company;
END;
$$;

-- 4. Update join_company to enforce email-domain match when set
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
  recent_attempts integer;
  normalized text;
  caller_email text;
  caller_domain text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to join a company';
  END IF;

  normalized := upper(trim(_join_code));

  DELETE FROM public.join_attempts
   WHERE user_id = auth.uid()
     AND attempted_at < now() - interval '24 hours';

  SELECT count(*) INTO recent_attempts
  FROM public.join_attempts
  WHERE user_id = auth.uid()
    AND attempted_at > now() - interval '1 hour';

  IF recent_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many join attempts. Please try again in an hour.';
  END IF;

  SELECT * INTO target_company FROM public.companies WHERE join_code = normalized;

  IF target_company.id IS NULL THEN
    INSERT INTO public.join_attempts (user_id, attempted_code, success)
    VALUES (auth.uid(), normalized, false);
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  -- Enforce email-domain restriction if the company has one
  IF target_company.allowed_email_domain IS NOT NULL THEN
    SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
    caller_domain := lower(split_part(caller_email, '@', 2));

    IF caller_domain <> target_company.allowed_email_domain THEN
      INSERT INTO public.join_attempts (user_id, attempted_code, success)
      VALUES (auth.uid(), normalized, false);
      RAISE EXCEPTION 'This company only allows members with @% email addresses',
        target_company.allowed_email_domain;
    END IF;
  END IF;

  SELECT company_id, COALESCE(total_points, 0)
    INTO current_company_id, user_points
  FROM public.users WHERE id = auth.uid();

  IF current_company_id IS NOT NULL AND current_company_id <> target_company.id THEN
    UPDATE public.companies
       SET total_points = GREATEST(0, COALESCE(total_points, 0) - user_points)
     WHERE id = current_company_id;
  END IF;

  UPDATE public.users SET company_id = target_company.id WHERE id = auth.uid();

  IF current_company_id IS DISTINCT FROM target_company.id THEN
    UPDATE public.companies
       SET total_points = COALESCE(total_points, 0) + user_points
     WHERE id = target_company.id
     RETURNING * INTO target_company;
  END IF;

  INSERT INTO public.join_attempts (user_id, attempted_code, success)
  VALUES (auth.uid(), normalized, true);

  RETURN target_company;
END;
$$;
