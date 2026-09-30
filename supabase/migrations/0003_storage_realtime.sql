-- ============================================================================
-- 0003_storage_realtime.sql — Storage bucket + Realtime publication
-- ============================================================================

-- ---------------------------------------------------------------------------
-- product-images bucket: public read, admin write (per PRD Integrations).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880, -- 5 MB per image
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "product_images_public_read" on storage.objects
  for select
  using (bucket_id = 'product-images');

create policy "product_images_admin_insert" on storage.objects
  for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_update" on storage.objects
  for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "product_images_admin_delete" on storage.objects
  for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Realtime (postgres_changes):
--   bookings        — live pending list + badge on the admin dashboard
--   products/variants — catalog freshness (PRD: "optionally")
-- Realtime enforces RLS as the subscribing client, so only admins receive
-- booking events for other users' rows.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.product_variants;

-- Full replica identity so UPDATE/DELETE payloads include the changed row
-- (RLS caveat applies: `old` still carries only the PK for protected tables).
alter table public.bookings replica identity full;
