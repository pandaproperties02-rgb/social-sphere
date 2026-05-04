-- ============================================================
-- 1. PROVIDERS
-- ============================================================
CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_url text NOT NULL,
  api_key text NOT NULL,
  balance numeric(14,4) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage providers" ON public.providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 2. APP SETTINGS (singleton row id=1)
-- ============================================================
CREATE TABLE public.app_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  default_markup_percent numeric(6,2) NOT NULL DEFAULT 25.00,
  currency text NOT NULL DEFAULT 'USD',
  paystack_public_key text,
  mpesa_shortcode text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);
INSERT INTO public.app_settings(id) VALUES (1);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. SERVICES — link to providers + cost rate
-- ============================================================
ALTER TABLE public.services
  ADD COLUMN provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  ADD COLUMN provider_service_id text,
  ADD COLUMN cost_rate numeric(14,6) NOT NULL DEFAULT 0;

CREATE INDEX idx_services_provider ON public.services(provider_id);

-- ============================================================
-- 4. ORDERS — store cost for profit reporting
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN cost numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN error text;

CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_provider_order ON public.orders(provider_order_id);

-- ============================================================
-- 5. TICKETS
-- ============================================================
CREATE TABLE public.tickets (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own tickets" ON public.tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user creates own tickets" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin manage tickets" ON public.tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ticket_messages (
  id bigserial PRIMARY KEY,
  ticket_id bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg read own ticket" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "msg insert own ticket" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- ============================================================
-- 6. API KEYS (reseller)
-- ============================================================
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own api key" ON public.api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin manage api keys" ON public.api_keys
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 7. PAYMENT INTENTS (Paystack / M-Pesa)
-- ============================================================
CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,                 -- 'paystack' | 'mpesa'
  amount numeric(14,4) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending', -- pending | paid | failed | canceled
  reference text NOT NULL UNIQUE,         -- our internal ref / paystack ref
  provider_ref text,                      -- gateway-side id once known
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own intents" ON public.payment_intents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin manage intents" ON public.payment_intents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 8. RPCs
-- ============================================================

-- Update place_order to also record provider cost
CREATE OR REPLACE FUNCTION public.place_order(_service_id bigint, _link text, _quantity integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _svc record;
  _charge numeric(14,4);
  _cost numeric(14,4);
  _bal numeric(14,4);
  _order_id bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _svc FROM public.services WHERE id = _service_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'service unavailable'; END IF;
  IF _quantity < _svc.min_order OR _quantity > _svc.max_order THEN
    RAISE EXCEPTION 'quantity out of range (%-%)', _svc.min_order, _svc.max_order;
  END IF;
  _charge := round((_svc.rate      * _quantity / 1000.0)::numeric, 4);
  _cost   := round((_svc.cost_rate * _quantity / 1000.0)::numeric, 4);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  IF _bal < _charge THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  UPDATE public.wallets SET balance = balance - _charge, updated_at = now() WHERE user_id = _uid;
  INSERT INTO public.orders(user_id, service_id, link, quantity, charge, cost, remains)
    VALUES (_uid, _service_id, _link, _quantity, _charge, _cost, _quantity)
    RETURNING id INTO _order_id;
  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_uid, -_charge, 'order', 'order#' || _order_id);
  RETURN _order_id;
END; $$;

-- Admin: set markup percent
CREATE OR REPLACE FUNCTION public.set_markup(_percent numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _percent < 0 OR _percent > 1000 THEN RAISE EXCEPTION 'invalid markup'; END IF;
  UPDATE public.app_settings SET default_markup_percent = _percent, updated_at = now() WHERE id = 1;
  RETURN _percent;
END; $$;

-- Admin: credit a user's wallet manually
CREATE OR REPLACE FUNCTION public.admin_credit_wallet(_user_id uuid, _amount numeric, _reference text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _new numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _amount = 0 THEN RAISE EXCEPTION 'amount required'; END IF;
  UPDATE public.wallets SET balance = balance + _amount, updated_at = now()
    WHERE user_id = _user_id RETURNING balance INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;
  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_user_id, _amount, CASE WHEN _amount > 0 THEN 'admin_credit' ELSE 'admin_debit' END, _reference);
  RETURN _new;
END; $$;

-- Webhook handler: credit a payment_intent (called via service role only)
CREATE OR REPLACE FUNCTION public.complete_payment_intent(_intent_id uuid, _provider_ref text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _intent record; _new numeric;
BEGIN
  SELECT * INTO _intent FROM public.payment_intents WHERE id = _intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'intent not found'; END IF;
  IF _intent.status = 'paid' THEN
    SELECT balance INTO _new FROM public.wallets WHERE user_id = _intent.user_id;
    RETURN _new; -- idempotent
  END IF;

  UPDATE public.wallets SET balance = balance + _intent.amount, updated_at = now()
    WHERE user_id = _intent.user_id RETURNING balance INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;

  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_intent.user_id, _intent.amount, _intent.provider, _intent.reference);

  UPDATE public.payment_intents
    SET status = 'paid', provider_ref = _provider_ref, updated_at = now()
    WHERE id = _intent_id;

  RETURN _new;
END; $$;

-- Place order via reseller API key (no auth.uid())
CREATE OR REPLACE FUNCTION public.place_order_for(_user_id uuid, _service_id bigint, _link text, _quantity integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _svc record;
  _charge numeric(14,4);
  _cost numeric(14,4);
  _bal numeric(14,4);
  _order_id bigint;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  SELECT * INTO _svc FROM public.services WHERE id = _service_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'service unavailable'; END IF;
  IF _quantity < _svc.min_order OR _quantity > _svc.max_order THEN
    RAISE EXCEPTION 'quantity out of range (%-%)', _svc.min_order, _svc.max_order;
  END IF;
  _charge := round((_svc.rate      * _quantity / 1000.0)::numeric, 4);
  _cost   := round((_svc.cost_rate * _quantity / 1000.0)::numeric, 4);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  IF _bal < _charge THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  UPDATE public.wallets SET balance = balance - _charge, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.orders(user_id, service_id, link, quantity, charge, cost, remains)
    VALUES (_user_id, _service_id, _link, _quantity, _charge, _cost, _quantity)
    RETURNING id INTO _order_id;
  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_user_id, -_charge, 'order_api', 'order#' || _order_id);
  RETURN _order_id;
END; $$;