-- Re-add providers table for live services
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_url text,
  api_key text,
  balance numeric(14,4) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Re-add provider_id to services if it doesn't exist
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_service_id text;

CREATE INDEX IF NOT EXISTS idx_services_provider ON public.services(provider_id);

-- Create default provider
INSERT INTO public.providers (id, name, is_active)
VALUES ('550e8400-e29b-41d4-a716-446655440000'::uuid, 'Social Media Bot', true)
ON CONFLICT (id) DO NOTHING;

-- Ensure categories exist
INSERT INTO public.categories (name, sort_order)
VALUES 
  ('Instagram', 1),
  ('TikTok', 2),
  ('YouTube', 3),
  ('Twitter', 4)
ON CONFLICT (name) DO NOTHING;

-- Instagram Services
INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'Instagram' ORDER BY id LIMIT 1),
  'Instagram Followers',
  0.0050,
  100,
  100000,
  '1-24 hours',
  'Real Instagram followers delivery',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'Instagram Followers' 
);

INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'Instagram' ORDER BY id LIMIT 1),
  'Instagram Likes',
  0.0025,
  50,
  50000,
  '1-12 hours',
  'Real Instagram likes on posts',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'Instagram Likes'
);

INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'Instagram' ORDER BY id LIMIT 1),
  'Instagram Comments',
  0.0150,
  20,
  10000,
  '2-48 hours',
  'Real Instagram comments with engagement',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'Instagram Comments'
);

-- TikTok Services
INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'TikTok' ORDER BY id LIMIT 1),
  'TikTok Followers',
  0.0075,
  100,
  100000,
  '1-24 hours',
  'Real TikTok followers',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'TikTok Followers'
);

INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'TikTok' ORDER BY id LIMIT 1),
  'TikTok Likes',
  0.0030,
  100,
  100000,
  '1-12 hours',
  'Real TikTok video likes',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'TikTok Likes'
);

-- YouTube Services
INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'YouTube' ORDER BY id LIMIT 1),
  'YouTube Subscribers',
  0.0100,
  50,
  50000,
  '2-48 hours',
  'Real YouTube channel subscribers',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'YouTube Subscribers'
);

INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'YouTube' ORDER BY id LIMIT 1),
  'YouTube Views',
  0.0020,
  100,
  1000000,
  '1-24 hours',
  'Real YouTube video views',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'YouTube Views'
);

-- Twitter Services
INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'Twitter' ORDER BY id LIMIT 1),
  'Twitter Followers',
  0.0080,
  50,
  50000,
  '1-24 hours',
  'Real Twitter followers',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'Twitter Followers'
);

INSERT INTO public.services (category_id, name, rate, min_order, max_order, avg_time, description, status, provider_id)
SELECT 
  (SELECT id FROM categories WHERE name = 'Twitter' ORDER BY id LIMIT 1),
  'Twitter Likes',
  0.0040,
  100,
  100000,
  '1-12 hours',
  'Real Twitter likes on tweets',
  'active',
  '550e8400-e29b-41d4-a716-446655440000'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE name = 'Twitter Likes'
);
