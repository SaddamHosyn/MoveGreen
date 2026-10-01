-- Update calculate_activity_points to use the CO2 avoided formula
-- Points = ROUND(distance_km * 0.129 * multiplier)
CREATE OR REPLACE FUNCTION public.calculate_activity_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rate integer;
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

  -- Formula: CO2 avoided (distance * 0.129) * effort multiplier (rate)
  -- Rounded to nearest integer as total_points is an integer field
  NEW.points_earned := ROUND(NEW.distance_km * 0.129 * rate);
  RETURN NEW;
END;
$$;
