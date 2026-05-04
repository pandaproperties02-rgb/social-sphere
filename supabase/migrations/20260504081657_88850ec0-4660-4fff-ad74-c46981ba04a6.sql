
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- WALLETS
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(14,4) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin manage wallets" ON public.wallets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,4) NOT NULL,
  type text NOT NULL, -- 'deposit' | 'order' | 'refund'
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own tx" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- SERVICES
CREATE TABLE public.services (
  id bigserial PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  rate numeric(12,4) NOT NULL,         -- price per 1000
  min_order int NOT NULL DEFAULT 100,
  max_order int NOT NULL DEFAULT 100000,
  avg_time text DEFAULT 'Not enough data',
  description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX services_category_idx ON public.services(category_id);
CREATE INDEX services_name_idx ON public.services USING gin (to_tsvector('simple', name));
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services public read" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage services" ON public.services FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ORDERS
CREATE TABLE public.orders (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id bigint NOT NULL REFERENCES public.services(id),
  link text NOT NULL,
  quantity int NOT NULL,
  charge numeric(14,4) NOT NULL,
  start_count int DEFAULT 0,
  remains int DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | in_progress | completed | partial | canceled
  provider_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_idx ON public.orders(user_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin manage orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- TRIGGERS: auto-create profile, wallet, role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)));
  INSERT INTO public.wallets(user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ATOMIC ORDER FUNCTION: deduct wallet + insert order
CREATE OR REPLACE FUNCTION public.place_order(_service_id bigint, _link text, _quantity int)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _svc record;
  _charge numeric(14,4);
  _bal numeric(14,4);
  _order_id bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _svc FROM public.services WHERE id = _service_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'service unavailable'; END IF;
  IF _quantity < _svc.min_order OR _quantity > _svc.max_order THEN
    RAISE EXCEPTION 'quantity out of range (%-%)', _svc.min_order, _svc.max_order;
  END IF;
  _charge := round((_svc.rate * _quantity / 1000.0)::numeric, 4);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  IF _bal < _charge THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  UPDATE public.wallets SET balance = balance - _charge, updated_at = now() WHERE user_id = _uid;
  INSERT INTO public.orders(user_id, service_id, link, quantity, charge, remains)
    VALUES (_uid, _service_id, _link, _quantity, _charge, _quantity)
    RETURNING id INTO _order_id;
  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_uid, -_charge, 'order', 'order#' || _order_id);
  RETURN _order_id;
END; $$;

-- ADMIN/SELF deposit (for manual top-ups in MVP)
CREATE OR REPLACE FUNCTION public.add_funds(_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _new numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount <= 0 OR _amount > 10000 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  UPDATE public.wallets SET balance = balance + _amount, updated_at = now()
    WHERE user_id = _uid RETURNING balance INTO _new;
  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_uid, _amount, 'deposit', 'manual');
  RETURN _new;
END; $$;
