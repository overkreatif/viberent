-- ============================================================================
-- 0002_rls_rpc.sql — Row Level Security + availability RPC
-- Matrix in prd/overview.md "RLS matrix". Admin checks are centralised in the
-- SECURITY DEFINER is_admin() helper to avoid recursive policy lookups.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- SECURITY DEFINER so policies can call it without triggering RLS recursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ===========================================================================
-- profiles
--   SELECT : own row, or any row for admins
--   INSERT : none via API (created by the create-client-account Edge Function
--            using the service role, which bypasses RLS)
--   UPDATE : own row (name/phone only — role is not updatable via API),
--            or any row for admins
-- ===========================================================================
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin" on public.profiles
  for update
  to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Restrict the *columns* a non-admin can touch: default grants give
-- authenticated UPDATE on every column, which would let a client flip their
-- own role. Revoke that and re-grant only name/phone.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- ===========================================================================
-- categories — authenticated read; admin write.
-- ===========================================================================
alter table public.categories enable row level security;

create policy "categories_select_authenticated" on public.categories
  for select to authenticated using (true);

create policy "categories_admin_insert" on public.categories
  for insert to authenticated with check (public.is_admin());

create policy "categories_admin_update" on public.categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "categories_admin_delete" on public.categories
  for delete to authenticated using (public.is_admin());

-- ===========================================================================
-- products — authenticated read; admin write.
-- ===========================================================================
alter table public.products enable row level security;

create policy "products_select_authenticated" on public.products
  for select to authenticated using (true);

create policy "products_admin_insert" on public.products
  for insert to authenticated with check (public.is_admin());

create policy "products_admin_update" on public.products
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "products_admin_delete" on public.products
  for delete to authenticated using (public.is_admin());

-- ===========================================================================
-- product_categories — authenticated read; admin write.
-- ===========================================================================
alter table public.product_categories enable row level security;

create policy "product_categories_select_authenticated" on public.product_categories
  for select to authenticated using (true);

create policy "product_categories_admin_insert" on public.product_categories
  for insert to authenticated with check (public.is_admin());

create policy "product_categories_admin_update" on public.product_categories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "product_categories_admin_delete" on public.product_categories
  for delete to authenticated using (public.is_admin());

-- ===========================================================================
-- product_variants — authenticated read; admin write.
-- ===========================================================================
alter table public.product_variants enable row level security;

create policy "product_variants_select_authenticated" on public.product_variants
  for select to authenticated using (true);

create policy "product_variants_admin_insert" on public.product_variants
  for insert to authenticated with check (public.is_admin());

create policy "product_variants_admin_update" on public.product_variants
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "product_variants_admin_delete" on public.product_variants
  for delete to authenticated using (public.is_admin());

-- ===========================================================================
-- wishlists — strictly per-owner (no admin access).
-- ===========================================================================
alter table public.wishlists enable row level security;

create policy "wishlists_select_own" on public.wishlists
  for select to authenticated using (user_id = auth.uid());

create policy "wishlists_insert_own" on public.wishlists
  for insert to authenticated with check (user_id = auth.uid());

create policy "wishlists_delete_own" on public.wishlists
  for delete to authenticated using (user_id = auth.uid());

-- ===========================================================================
-- bookings
--   SELECT : own rows, or all rows for admins
--   INSERT : clients may only create their OWN pending request
--            admins may only create blocked rows (user_id NULL) — this is
--            the admin "Blocking" tool (PRD User Flow Admin #3)
--   UPDATE / DELETE : admin only (status transitions / cleanup)
-- ===========================================================================
alter table public.bookings enable row level security;

create policy "bookings_select_own_or_admin" on public.bookings
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "bookings_insert_own_pending" on public.bookings
  for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

create policy "bookings_insert_admin_block" on public.bookings
  for insert
  to authenticated
  with check (public.is_admin() and status = 'blocked_by_admin' and user_id is null);

create policy "bookings_update_admin" on public.bookings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "bookings_delete_admin" on public.bookings
  for delete
  to authenticated
  using (public.is_admin());

-- ===========================================================================
-- settings — singleton read by all authenticated (for the WA deep link);
-- admin write only.
-- ===========================================================================
alter table public.settings enable row level security;

create policy "settings_select_authenticated" on public.settings
  for select to authenticated using (true);

create policy "settings_update_admin" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- get_booked_ranges() — the ONLY way clients learn availability.
-- SECURITY DEFINER + narrow return columns: product/size/dates/status for
-- confirmed + admin-blocked bookings. Never exposes client identities or
-- pending/rejected rows. Revoked from anon, granted to authenticated.
-- ===========================================================================
create or replace function public.get_booked_ranges()
returns table (
  product_id uuid,
  size       text,
  start_date date,
  end_date   date,
  status     text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.product_id, b.size, b.start_date, b.end_date, b.status
  from public.bookings b
  where b.status in ('confirmed', 'blocked_by_admin');
$$;

revoke execute on function public.get_booked_ranges() from public;
grant execute on function public.get_booked_ranges() to authenticated;
