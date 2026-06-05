CREATE OR REPLACE FUNCTION public.generate_join_code()
 RETURNS text
 LANGUAGE sql
AS $function$
  SELECT lpad((floor(random() * 10000))::int::text, 4, '0');
$function$;