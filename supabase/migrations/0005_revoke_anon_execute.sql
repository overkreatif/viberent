-- ============================================================================
-- 0005_revoke_anon_execute.sql
-- Supabase's default privileges grant EXECUTE on public functions to the
-- `anon` role directly, so `revoke ... from public` alone does not remove it.
-- Both SECURITY DEFINER helpers are intended only for signed-in users:
--   * get_booked_ranges() — availability data for authenticated clients
--   * is_admin()          — referenced by RLS policies (authenticated context)
-- Anon (unauthenticated) must not be able to call either.
-- ============================================================================
revoke execute on function public.get_booked_ranges() from anon;
revoke execute on function public.is_admin() from anon;

-- Re-affirm the intended grants (idempotent).
grant execute on function public.get_booked_ranges() to authenticated;
grant execute on function public.is_admin() to authenticated;
