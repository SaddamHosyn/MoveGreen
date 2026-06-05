
-- 1. Blocklist of personal/free email providers
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blocked_email_domains TO anon, authenticated;
GRANT ALL ON public.blocked_email_domains TO service_role;

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read blocked domains" ON public.blocked_email_domains;
CREATE POLICY "Anyone can read blocked domains"
  ON public.blocked_email_domains FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only platform admins can manage blocked domains" ON public.blocked_email_domains;
CREATE POLICY "Only platform admins can manage blocked domains"
  ON public.blocked_email_domains FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'));

INSERT INTO public.blocked_email_domains (domain, reason) VALUES
  ('gmail.com','Personal email provider'),
  ('googlemail.com','Personal email provider'),
  ('yahoo.com','Personal email provider'),
  ('yahoo.co.uk','Personal email provider'),
  ('outlook.com','Personal email provider'),
  ('hotmail.com','Personal email provider'),
  ('hotmail.co.uk','Personal email provider'),
  ('live.com','Personal email provider'),
  ('msn.com','Personal email provider'),
  ('icloud.com','Personal email provider'),
  ('me.com','Personal email provider'),
  ('mac.com','Personal email provider'),
  ('proton.me','Personal email provider'),
  ('protonmail.com','Personal email provider'),
  ('aol.com','Personal email provider'),
  ('gmx.com','Personal email provider'),
  ('gmx.de','Personal email provider'),
  ('mail.com','Personal email provider'),
  ('yandex.com','Personal email provider'),
  ('yandex.ru','Personal email provider'),
  ('zoho.com','Personal email provider'),
  ('fastmail.com','Personal email provider'),
  ('tutanota.com','Personal email provider'),
  ('tuta.io','Personal email provider'),
  ('duck.com','Personal email provider'),
  ('qq.com','Personal email provider'),
  ('163.com','Personal email provider'),
  ('126.com','Personal email provider'),
  ('sina.com','Personal email provider')
ON CONFLICT (domain) DO NOTHING;

-- 2. Drop old create_company (signature change: removing DEFAULT requires drop)
DROP FUNCTION IF EXISTS public.create_company(text, text, text);

CREATE FUNCTION public.create_company(
  _name text,
  _public_slug text,
  _allowed_email_domain text
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

  IF _allowed_email_domain IS NULL OR length(trim(_allowed_email_domain)) = 0 THEN
    RAISE EXCEPTION 'A corporate email domain is required (e.g. yourcompany.com). Personal email providers like gmail.com are not allowed.';
  END IF;

  normalized_domain := lower(trim(_allowed_email_domain));
  IF normalized_domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email domain format (e.g. yourcompany.com)';
  END IF;

  IF EXISTS (SELECT 1 FROM public.blocked_email_domains WHERE domain = normalized_domain) THEN
    RAISE EXCEPTION '"%" is a personal email provider and cannot be used as a company domain. Please use your corporate email domain.', normalized_domain;
  END IF;

  SELECT email INTO caller_email FROM auth.users WHERE id = auth.uid();
  caller_domain := lower(split_part(caller_email, '@', 2));

  IF caller_domain <> normalized_domain THEN
    RAISE EXCEPTION 'You can only create a company for your own email domain (%). Your email is @%. Sign up with a @% email address to create this company.',
      normalized_domain, caller_domain, normalized_domain;
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
