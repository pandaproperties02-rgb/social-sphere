ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '5 days');

UPDATE public.profiles SET trial_ends_at = (created_at + interval '5 days') WHERE trial_ends_at IS NULL OR trial_ends_at < created_at + interval '5 days';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles(id, email, username, trial_ends_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)), now() + interval '5 days');
  INSERT INTO public.wallets(user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $function$;