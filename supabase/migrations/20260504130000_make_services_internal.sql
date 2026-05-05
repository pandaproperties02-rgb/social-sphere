-- Make all services internal - we are the providers, no outsourcing
UPDATE public.services
SET provider_id = NULL
WHERE provider_id IS NOT NULL;

-- Update the place_order function to handle internal services
-- (Already updated in previous migration, but ensuring consistency)