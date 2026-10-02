-- Update scoring rules to match the user's requested values multiplied by 10

UPDATE public.scoring_rules SET points_per_km = 20 WHERE transport_type = 'Walk';
UPDATE public.scoring_rules SET points_per_km = 15 WHERE transport_type = 'Bike';
UPDATE public.scoring_rules SET points_per_km = 12 WHERE transport_type = 'Electric Bike';
UPDATE public.scoring_rules SET points_per_km = 13 WHERE transport_type = 'E-Scooter';
UPDATE public.scoring_rules SET points_per_km = 10 WHERE transport_type = 'Bus';
UPDATE public.scoring_rules SET points_per_km = 10 WHERE transport_type = 'Carpool';
