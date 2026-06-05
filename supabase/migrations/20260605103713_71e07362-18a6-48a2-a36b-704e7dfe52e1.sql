
-- Allow authenticated users to insert their own public.users row
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Make redundant inserts (trigger already created the row) a silent no-op
CREATE OR REPLACE FUNCTION public.users_insert_idempotent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NULL; -- skip duplicate insert silently
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_insert_idempotent ON public.users;
CREATE TRIGGER users_insert_idempotent
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.users_insert_idempotent();
