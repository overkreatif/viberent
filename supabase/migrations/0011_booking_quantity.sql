alter table public.bookings
  add column if not exists quantity integer;

update public.bookings
set quantity = 1
where quantity is null;

alter table public.bookings
  alter column quantity set default 1,
  alter column quantity set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_quantity_positive'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_quantity_positive check (quantity > 0);
  end if;
end;
$$;

drop function if exists public.get_booked_ranges();

create function public.get_booked_ranges()
returns table (
  product_id uuid,
  size       text,
  quantity   integer,
  start_date date,
  end_date   date,
  status     text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.product_id, b.size, b.quantity, b.start_date, b.end_date, b.status
  from public.bookings b
  where b.status in ('pending', 'confirmed', 'blocked_by_admin');
$$;

revoke execute on function public.get_booked_ranges() from public, anon;
grant execute on function public.get_booked_ranges() to authenticated;

create or replace function public.check_booking_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  variant_stock integer;
  peak_reserved integer;
begin
  if new.status not in ('pending', 'confirmed', 'blocked_by_admin') then
    return new;
  end if;

  select pv.total_stock
  into variant_stock
  from public.product_variants pv
  where pv.product_id = new.product_id and pv.size = new.size
  for update;

  if variant_stock is null then
    raise exception 'Product size variant not found';
  end if;

  select coalesce(max(daily_reserved.quantity), 0)
  into peak_reserved
  from (
    select coalesce(sum(b.quantity), 0) as quantity
    from generate_series(
      new.start_date::timestamp,
      new.end_date::timestamp,
      interval '1 day'
    ) as rental_day(day)
    left join public.bookings b
      on b.product_id = new.product_id
      and b.size = new.size
      and b.id is distinct from new.id
      and b.status in ('pending', 'confirmed', 'blocked_by_admin')
      and b.start_date <= rental_day.day::date
      and b.end_date >= rental_day.day::date
    group by rental_day.day
  ) as daily_reserved;

  if peak_reserved + new.quantity > variant_stock then
    raise exception 'Not enough inventory for the selected dates and quantity';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_check_inventory on public.bookings;
create trigger bookings_check_inventory
before insert or update of product_id, size, quantity, start_date, end_date, status
on public.bookings
for each row execute function public.check_booking_inventory();