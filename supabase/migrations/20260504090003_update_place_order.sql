-- Update place_order to remove cost calculation
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
  INSERT INTO public.orders(user_id, service_id, link, quantity, charge, remains, status)
    VALUES (_uid, _service_id, _link, _quantity, _charge, _quantity, 'in_progress')
    RETURNING id INTO _order_id;
  INSERT INTO public.wallet_transactions(user_id, amount, type, reference)
    VALUES (_uid, -_charge, 'order', 'order#' || _order_id);
  RETURN _order_id;
END; $$;