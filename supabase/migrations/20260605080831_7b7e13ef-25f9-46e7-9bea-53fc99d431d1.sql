
-- =========================================================
-- 1. JOIN ATTEMPTS table (for rate limiting)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.join_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  attempted_code text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.join_attempts TO authenticated;
GRANT ALL ON public.join_attempts TO service_role;

ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attempts" ON public.join_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own attempts" ON public.join_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_join_attempts_user_time
  ON public.join_attempts (user_id, attempted_at DESC);

-- =========================================================
-- 2. CODE FORMAT VALIDATION on companies.join_code
-- =========================================================
-- Uppercase letters, numbers, dashes; 4–20 chars
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_join_code_format;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_join_code_format
  CHECK (join_code ~ '^[A-Z0-9-]{4,20}$');

-- Unique already-ish via default? Make it explicit.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_join_code_unique'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_join_code_unique UNIQUE (join_code);
  END IF;
END $$;

-- =========================================================
-- 3. set_company_join_code RPC (admin only)
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_company_join_code(
  _company_id uuid,
  _new_code text
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RAISE EXCEPTION 'Invalid code. Use 4–20 uppercase letters, numbers, or dashes (e.g. VIKING-2026)';
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
$$;

-- =========================================================
-- 4. REWRITE join_company with rate limiting
-- =========================================================
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to join a company';
  END IF;

  normalized := upper(trim(_join_code));

  -- Cleanup old attempts (>24h) to keep table small
  DELETE FROM public.join_attempts
   WHERE user_id = auth.uid()
     AND attempted_at < now() - interval '24 hours';

  -- Rate limit: max 5 attempts per hour per user
  SELECT count(*) INTO recent_attempts
  FROM public.join_attempts
  WHERE user_id = auth.uid()
    AND attempted_at > now() - interval '1 hour';

  IF recent_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many join attempts. Please try again in an hour.';
  END IF;

  -- Look up company
  SELECT * INTO target_company FROM public.companies WHERE join_code = normalized;

  IF target_company.id IS NULL THEN
    INSERT INTO public.join_attempts (user_id, attempted_code, success)
    VALUES (auth.uid(), normalized, false);
    RAISE EXCEPTION 'Invalid join code';
  END IF;

  -- Get user's current company & points
  SELECT company_id, COALESCE(total_points, 0)
    INTO current_company_id, user_points
  FROM public.users WHERE id = auth.uid();

  -- Transfer points from old company
  IF current_company_id IS NOT NULL AND current_company_id <> target_company.id THEN
    UPDATE public.companies
       SET total_points = GREATEST(0, COALESCE(total_points, 0) - user_points)
     WHERE id = current_company_id;
  END IF;

  -- Move user
  UPDATE public.users SET company_id = target_company.id WHERE id = auth.uid();

  -- Add points to new company
  IF current_company_id IS DISTINCT FROM target_company.id THEN
    UPDATE public.companies
       SET total_points = COALESCE(total_points, 0) + user_points
     WHERE id = target_company.id
     RETURNING * INTO target_company;
  END IF;

  -- Log success
  INSERT INTO public.join_attempts (user_id, attempted_code, success)
  VALUES (auth.uid(), normalized, true);

  RETURN target_company;
END;
$$;
