-- Remove provider dependencies for own deliveries
ALTER TABLE public.services
  DROP COLUMN provider_id,
  DROP COLUMN provider_service_id,
  DROP COLUMN cost_rate;

-- Update orders to remove cost
ALTER TABLE public.orders
  DROP COLUMN cost;

-- Remove providers table as not needed
DROP TABLE public.providers;

-- Remove app_settings related to providers
ALTER TABLE public.app_settings
  DROP COLUMN paystack_public_key,
  DROP COLUMN mpesa_shortcode;