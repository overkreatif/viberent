create or replace function public.enforce_booking_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status in ('rejected', 'blocked_by_admin') and new.status <> old.status then
    raise exception 'Booking status % is terminal', old.status
      using errcode = '23514';
  end if;

  if old.status = 'confirmed' and new.status = 'pending' then
    raise exception 'Confirmed bookings cannot return to pending'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_enforce_status_transition on public.bookings;
create trigger bookings_enforce_status_transition
before update of status on public.bookings
for each row execute function public.enforce_booking_status_transition();

create or replace function public.broadcast_inventory_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    '{"event":"inventory_changed"}'::jsonb,
    'inventory_changed',
    'availability-inventory',
    false
  );
  return null;
end;
$$;

drop trigger if exists bookings_broadcast_inventory_change on public.bookings;
create trigger bookings_broadcast_inventory_change
after insert or update or delete on public.bookings
for each row execute function public.broadcast_inventory_change();