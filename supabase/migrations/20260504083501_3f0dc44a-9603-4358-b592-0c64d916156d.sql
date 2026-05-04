REVOKE EXECUTE ON FUNCTION public.place_order_for(uuid, bigint, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_payment_intent(uuid, text) FROM anon, authenticated;