
CREATE OR REPLACE FUNCTION public.place_order(_service_id bigint, _link text, _quantity integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _svc record;
  _charge numeric(14,4);
  _cost numeric(14,4);
  _bal numeric(14,4);
  _order_id bigint;
  _trial_active boolean := false;
  _effective_charge numeric(14,4);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO _svc FROM public.services WHERE id = _service_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'service unavailable'; END IF;
  IF _quantity < _svc.min_order OR _quantity > _svc.max_order THEN
    RAISE EXCEPTION 'quantity out of range (%-%)', _svc.min_order, _svc.max_order;
  END IF;
  _charge := round((_svc.rate      * _quantity / 1000.0)::numeric, 4);
  _cost   := round((_svc.cost_rate * _quantity / 1000.0)::numeric, 4);

  SELECT (trial_ends_at IS NOT NULL AND trial_ends_at > now())
    INTO _trial_active FROM public.profiles WHERE id = _uid;

  _effective_charge := CASE WHEN _trial_active THEN 0 ELSE _charge END;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _uid FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  IF _bal < _effective_charge THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  IF _effective_charge > 0 THEN
    UPDATE public.wallets SET balance = balance - _effective_charge, updated_at = now() WHERE user_id = _uid;
    INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
      VALUES (_uid, -_effective_charge, 'order', 'order#pending');
  END IF;

  INSERT INTO public.orders(user_id, service_id, link, quantity, charge, cost, remains)
    VALUES (_uid, _service_id, _link, _quantity, _effective_charge, _cost, _quantity)
    RETURNING id INTO _order_id;

  IF _effective_charge > 0 THEN
    UPDATE public.wallet_transactions SET reference = 'order#' || _order_id
      WHERE user_id = _uid AND reference = 'order#pending';
  ELSE
    INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
      VALUES (_uid, 0, 'order_trial', 'order#' || _order_id);
  END IF;

  RETURN _order_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.place_order_for(_user_id uuid, _service_id bigint, _link text, _quantity integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _svc record;
  _charge numeric(14,4);
  _cost numeric(14,4);
  _bal numeric(14,4);
  _order_id bigint;
  _trial_active boolean := false;
  _effective_charge numeric(14,4);
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user required'; END IF;
  SELECT * INTO _svc FROM public.services WHERE id = _service_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'service unavailable'; END IF;
  IF _quantity < _svc.min_order OR _quantity > _svc.max_order THEN
    RAISE EXCEPTION 'quantity out of range (%-%)', _svc.min_order, _svc.max_order;
  END IF;
  _charge := round((_svc.rate      * _quantity / 1000.0)::numeric, 4);
  _cost   := round((_svc.cost_rate * _quantity / 1000.0)::numeric, 4);

  SELECT (trial_ends_at IS NOT NULL AND trial_ends_at > now())
    INTO _trial_active FROM public.profiles WHERE id = _user_id;

  _effective_charge := CASE WHEN _trial_active THEN 0 ELSE _charge END;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _bal IS NULL THEN RAISE EXCEPTION 'wallet missing'; END IF;
  IF _bal < _effective_charge THEN RAISE EXCEPTION 'insufficient balance'; END IF;

  IF _effective_charge > 0 THEN
    UPDATE public.wallets SET balance = balance - _effective_charge, updated_at = now() WHERE user_id = _user_id;
  END IF;

  INSERT INTO public.orders(user_id, service_id, link, quantity, charge, cost, remains)
    VALUES (_user_id, _service_id, _link, _quantity, _effective_charge, _cost, _quantity)
    RETURNING id INTO _order_id;

  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_user_id, -_effective_charge,
            CASE WHEN _trial_active THEN 'order_trial_api' ELSE 'order_api' END,
            'order#' || _order_id);

  RETURN _order_id;
END; $function$;
