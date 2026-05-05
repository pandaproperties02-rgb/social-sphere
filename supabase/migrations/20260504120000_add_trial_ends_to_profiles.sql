-- Add a 5-day trial period to every member profile
ALTER TABLE public.profiles
  ADD COLUMN trial_ends_at timestamptz NOT NULL DEFAULT now() + INTERVAL '5 days';

UPDATE public.profiles
SET trial_ends_at = created_at + INTERVAL '5 days'
WHERE trial_ends_at IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, email, username, trial_ends_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)), now() + INTERVAL '5 days');
  INSERT INTO public.wallets(user_id, balance) VALUES (NEW.id, 0);
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
  _trial_end timestamptz;
  _trial_active boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT trial_ends_at INTO _trial_end FROM public.profiles WHERE id = _uid;
  IF FOUND AND _trial_end > now() THEN
    _trial_active := true;
  END IF;

  SELECT * INTO _svc FROM public.services WHERE id = _service_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'service unavailable'; END IF;
  IF _quantity < _svc.min_order OR _quantity > _svc.max_order THEN
    RAISE EXCEPTION 'quantity out of range (%-%)', _svc.min_order, _svc.max_order;
  END IF;

  _charge := round((_svc.rate * _quantity / 1000.0)::numeric, 4);
  _cost := round((_svc.cost_rate * _quantity / 1000.0)::numeric, 4);

  IF NOT _trial_active THEN
    SELECT balance INTO _bal FROM public.wallets WHERE user_id = _uid FOR UPDATE;
    IF _bal IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
    IF _bal < _charge THEN RAISE EXCEPTION 'insufficient balance'; END IF;
    UPDATE public.wallets SET balance = balance - _charge, updated_at = now() WHERE user_id = _uid;
  END IF;

  INSERT INTO public.orders(user_id, service_id, link, quantity, charge, cost, remains)
    VALUES (_uid, _service_id, _link, _quantity, CASE WHEN _trial_active THEN 0 ELSE _charge END, _cost, _quantity)
    RETURNING id INTO _order_id;

  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_uid, CASE WHEN _trial_active THEN 0 ELSE -_charge END,
            CASE WHEN _trial_active THEN 'trial_order' ELSE 'order' END,
            'order#' || _order_id);

  RETURN _order_id;
END; $$;
