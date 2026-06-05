
-- Action functions: signed-in users only
REVOKE EXECUTE ON FUNCTION public.create_company(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_company(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_company() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_company_join_code(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_company(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_company(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_join_code(uuid, text) TO authenticated;

-- Internal trigger / helper functions: not exposed via API at all
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_activity_points() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_totals_on_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_badges_after_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_join_code() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies (auth context), keep it callable by signed-in users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
