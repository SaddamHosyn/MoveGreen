
-- Switch points_per_km to numeric to support fractional multipliers
ALTER TABLE public.scoring_rules ALTER COLUMN points_per_km TYPE numeric(5,2);

-- Remove electric_bike
DELETE FROM public.scoring_rules WHERE transport_type = 'electric_bike';

-- Update existing rules to new CO2-credit multipliers
UPDATE public.scoring_rules SET points_per_km = 1.0, updated_at = now() WHERE transport_type = 'bus';
UPDATE public.scoring_rules SET points_per_km = 1.5, updated_at = now() WHERE transport_type = 'cycling';
UPDATE public.scoring_rules SET points_per_km = 2.0, updated_at = now() WHERE transport_type = 'walking';

-- Add carpooling
INSERT INTO public.scoring_rules (transport_type, points_per_km, active)
VALUES ('carpooling', 0.5, true)
ON CONFLICT (transport_type) DO UPDATE SET points_per_km = EXCLUDED.points_per_km, active = true, updated_at = now();

-- Update points calculation to use numeric rate
CREATE OR REPLACE FUNCTION public.calculate_activity_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rate numeric;
BEGIN
  IF NEW.distance_km <= 0 OR NEW.distance_km > 500 THEN
    RAISE EXCEPTION 'distance_km must be between 0 and 500';
  END IF;

  SELECT points_per_km INTO rate
  FROM public.scoring_rules
  WHERE transport_type = NEW.transport_type AND active = true;

  IF rate IS NULL THEN
    RAISE EXCEPTION 'Unknown or inactive transport_type: %', NEW.transport_type;
  END IF;

  NEW.points_earned := FLOOR(NEW.distance_km * rate);
  RETURN NEW;
END;
$function$;
