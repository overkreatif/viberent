-- ============================================================================
-- 0006_revoke_public_is_admin.sql
-- is_admin() inherits EXECUTE for every role (including anon) via the PUBLIC
-- pseudo-role default grant. Revoke PUBLIC, keep the authenticated grant that
-- RLS policies execute under.
-- ============================================================================
revoke execute on function public.is_admin() from public;

grant execute on function public.is_admin() to authenticated;
