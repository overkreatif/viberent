-- Pending client requests reserve inventory until confirmed or rejected.
-- The response remains narrow and never exposes client identities.
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
  where b.status in ('pending', 'confirmed', 'blocked_by_admin');
$$;

revoke execute on function public.get_booked_ranges() from public, anon;
grant execute on function public.get_booked_ranges() to authenticated;