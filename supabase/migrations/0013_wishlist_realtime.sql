do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'wishlists'
  ) then
    execute 'alter publication supabase_realtime add table public.wishlists';
  end if;
end;
$$;