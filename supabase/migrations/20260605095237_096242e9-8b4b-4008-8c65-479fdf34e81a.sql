
ALTER TABLE public.companies ALTER COLUMN allowed_email_domain SET NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_domain text;
  matched_company_id uuid;
BEGIN
  user_domain := lower(split_part(NEW.email, '@', 2));

  IF user_domain IS NULL OR length(user_domain) = 0 THEN
    RAISE EXCEPTION 'A valid email address is required to sign up';
  END IF;

  IF EXISTS (SELECT 1 FROM public.blocked_email_domains WHERE domain = user_domain) THEN
    RAISE EXCEPTION 'Sign-up with personal email providers (like %) is not allowed. Please use your corporate email address.', user_domain;
  END IF;

  SELECT id INTO matched_company_id
  FROM public.companies
  WHERE allowed_email_domain = user_domain
  LIMIT 1;

  INSERT INTO public.users (id, name, company_id, total_points)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1), 'New User'),
    matched_company_id,
    0
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_company(_name text, _public_slug text, _allowed_email_domain text)
RETURNS companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company public.companies;
  caller_email text;
  caller_confirmed timestamptz;
  caller_domain text;
  normalized_slug text;
  normalized_domain text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to create a company';
  END IF;

  SELECT email, email_confirmed_at INTO caller_email, caller_confirmed
  FROM auth.users WHERE id = auth.uid();

  IF caller_confirmed IS NULL THEN
    RAISE EXCEPTION 'You must confirm your email address before creating a company. Check your inbox for the confirmation link.';
  END IF;

  IF _name IS NULL OR length(trim(_name)) < 2 THEN
    RAISE EXCEPTION 'Company name must be at least 2 characters';
  END IF;

  normalized_slug := lower(trim(_public_slug));
  IF normalized_slug !~ '^[a-z0-9-]{2,40}$' THEN
    RAISE EXCEPTION 'Slug must be 2-40 lowercase letters, numbers, or dashes';
  END IF;

  IF _allowed_email_domain IS NULL OR length(trim(_allowed_email_domain)) = 0 THEN
    RAISE EXCEPTION 'A corporate email domain is required (e.g. yourcompany.com).';
  END IF;

  normalized_domain := lower(trim(_allowed_email_domain));
  IF normalized_domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email domain format (e.g. yourcompany.com)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.blocked_email_domains WHERE domain = normalized_domain) THEN
    RAISE EXCEPTION '"%" is a personal email provider and cannot be used as a company domain.', normalized_domain;
  END IF;

  caller_domain := lower(split_part(caller_email, '@', 2));

  IF caller_domain <> normalized_domain THEN
    RAISE EXCEPTION 'You can only create a company for your own email domain (%). Your email is @%.',
      normalized_domain, caller_domain;
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE public_slug = normalized_slug) THEN
    RAISE EXCEPTION 'That slug is already taken';
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE allowed_email_domain = normalized_domain) THEN
    RAISE EXCEPTION 'A company for the domain "%" already exists. Ask its admin for the join code instead.', normalized_domain;
  END IF;

  INSERT INTO public.companies (name, public_slug, created_by, allowed_email_domain)
  VALUES (trim(_name), normalized_slug, auth.uid(), normalized_domain)
  RETURNING * INTO new_company;

  UPDATE public.users SET company_id = new_company.id WHERE id = auth.uid();

  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (auth.uid(), 'company_admin', new_company.id);

  RETURN new_company;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_company(_join_code text)
RETURNS companies
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
  caller_confirmed timestamptz;
  caller_domain text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to join a company';
  END IF;

  SELECT email, email_confirmed_at INTO caller_email, caller_confirmed
  FROM auth.users WHERE id = auth.uid();

  IF caller_confirmed IS NULL THEN
    RAISE EXCEPTION 'You must confirm your email address before joining a company.';
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

  caller_domain := lower(split_part(caller_email, '@', 2));

  IF caller_domain <> target_company.allowed_email_domain THEN
    INSERT INTO public.join_attempts (user_id, attempted_code, success)
    VALUES (auth.uid(), normalized, false);
    RAISE EXCEPTION 'This company only allows members with @% email addresses',
      target_company.allowed_email_domain;
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
