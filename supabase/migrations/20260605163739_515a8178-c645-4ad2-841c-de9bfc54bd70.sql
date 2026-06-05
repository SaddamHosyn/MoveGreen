
-- 1. Add a stable code column to badges for code-based awarding
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS code text;
UPDATE public.badges SET code = lower(regexp_replace(name, '\W+', '_', 'g')) WHERE code IS NULL;
ALTER TABLE public.badges ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS badges_code_key ON public.badges(code);

-- 2. Seed the 8 required badges (idempotent on code)
INSERT INTO public.badges (code, name, description, threshold_km, transport_type) VALUES
  ('welcome_aboard',     'Welcome Aboard',     'Joined your first company',                          NULL, NULL),
  ('first_move',         'First Move',         'Logged your very first activity',                    NULL, NULL),
  ('10km_commuter',      '10km Commuter',      'Reached 10 km of total logged distance',             10,   NULL),
  ('century_club',       'Century Club',       'Reached 100 total points',                           NULL, NULL),
  ('eco_champion',       'Eco Champion',       'Reached 500 total points',                           NULL, NULL),
  ('marathon_walker',    'Marathon Walker',    'Walked a total of 42 km',                            42,   'walking'),
  ('tour_de_office',     'Tour de Office',     'Cycled a total of 50 km',                            50,   'cycling'),
  ('transport_explorer', 'Transport Explorer', 'Logged at least 3 different transport types',        NULL, NULL)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      threshold_km = EXCLUDED.threshold_km,
      transport_type = EXCLUDED.transport_type;

-- 3. user_badges already has PRIMARY KEY (user_id, badge_id) which guarantees uniqueness.
--    Add an explicit UNIQUE constraint as well for clarity / ON CONFLICT targeting.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_badges'::regclass
      AND contype = 'u'
      AND conname = 'user_badges_user_badge_unique'
  ) THEN
    ALTER TABLE public.user_badges
      ADD CONSTRAINT user_badges_user_badge_unique UNIQUE (user_id, badge_id);
  END IF;
END$$;

-- 4. Rewrite award_badges_after_activity with all milestone checks
CREATE OR REPLACE FUNCTION public.award_badges_after_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := NEW.user_id;
  v_total_points integer;
  v_total_km numeric;
  v_activity_count integer;
  v_walking_km numeric;
  v_cycling_km numeric;
  v_distinct_types integer;
BEGIN
  SELECT COALESCE(total_points, 0) INTO v_total_points
    FROM public.users WHERE id = v_user_id;

  SELECT
    COALESCE(SUM(distance_km), 0),
    COUNT(*),
    COALESCE(SUM(distance_km) FILTER (WHERE transport_type = 'walking'), 0),
    COALESCE(SUM(distance_km) FILTER (WHERE transport_type = 'cycling'), 0),
    COUNT(DISTINCT transport_type)
  INTO v_total_km, v_activity_count, v_walking_km, v_cycling_km, v_distinct_types
  FROM public.activities WHERE user_id = v_user_id;

  -- Helper insert per badge code; ON CONFLICT keeps it idempotent
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'first_move' AND v_activity_count = 1
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = '10km_commuter' AND v_total_km >= 10
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'century_club' AND v_total_points >= 100
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'eco_champion' AND v_total_points >= 500
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'marathon_walker' AND v_walking_km >= 42
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'tour_de_office' AND v_cycling_km >= 50
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user_id, b.id FROM public.badges b
  WHERE b.code = 'transport_explorer' AND v_distinct_types >= 3
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 5. Award 'Welcome Aboard' inside join_company
CREATE OR REPLACE FUNCTION public.join_company(_join_code text)
RETURNS companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Award the Welcome Aboard badge on successful join
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT auth.uid(), b.id FROM public.badges b WHERE b.code = 'welcome_aboard'
  ON CONFLICT DO NOTHING;

  RETURN target_company;
END;
$function$;
