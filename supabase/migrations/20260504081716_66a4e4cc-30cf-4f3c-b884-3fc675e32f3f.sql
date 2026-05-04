
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.place_order(bigint, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(bigint, text, int) TO authenticated;

REVOKE ALL ON FUNCTION public.add_funds(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_funds(numeric) TO authenticated;
