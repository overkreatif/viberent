-- ============================================================================
-- 0004_seed.sql — Dev/demo seed data (PRD "Bootstrap & seed")
--   * default categories
--   * 5 sample products with size variants + placeholder images
--   * settings row (admin WhatsApp number placeholder)
--   * two login-capable users: one admin, one client
--       admin : admin@viberent.id / Viberent@2026   (role = admin)
--       client: client@demo.id      / Client@2026    (role = client)
--     Passwords are bcrypt-hashed here via pgcrypto (extensions schema).
--     Identities rows are required for GoTrue sign-in to work.
--   !! CHANGE THESE CREDENTIALS BEFORE ANY PRODUCTION USE !!
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug) values
  ('Gaun',     'gaun'),
  ('Kebaya',   'kebaya'),
  ('Atasan',   'atasan'),
  ('Bawahan',  'bawahan'),
  ('Jas',      'jas'),
  ('Aksesoris','aksesoris')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Settings singleton (WhatsApp number placeholder — replace in production)
-- ---------------------------------------------------------------------------
insert into public.settings (id, admin_phone)
values (1, '6281234567890')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Sample products (placeholder images from picsum; replace with real uploads)
-- ---------------------------------------------------------------------------
insert into public.products (id, title, description, tier, color_theme, images) values
  ('a0000000-0000-0000-0000-000000000001',
   'Gaun Bridesmaid Sage',
   'Gaun bridesmaid long dress warna sage dengan detail renda halus. Cocok untuk acara pernikahan dan formal.',
   'Premium', 'Sage / Hijau Muda',
   array['https://picsum.photos/seed/bridesmaid-sage-1/900/1200',
         'https://picsum.photos/seed/bridesmaid-sage-2/900/1200']),
  ('a0000000-0000-0000-0000-000000000002',
   'Kebaya Modern Gold',
   'Kebaya modern dengan payet emas dan potongan klasik yang elegan. Tersedia untuk acara lamaran dan pernikahan.',
   'Premium', 'Gold / Emas',
   array['https://picsum.photos/seed/kebaya-gold-1/900/1200',
         'https://picsum.photos/seed/kebaya-gold-2/900/1200']),
  ('a0000000-0000-0000-0000-000000000003',
   'Gaun Pesta Hitam',
   'Gaun pesta warna hitam dengan potongan flowy, nyaman untuk acara malam dan pesta.',
   'Basic', 'Hitam',
   array['https://picsum.photos/seed/gaun-hitam-1/900/1200']),
  ('a0000000-0000-0000-0000-000000000004',
   'Jas Formal Navy',
   'Jas formal biru navy dengan bahan rapi, cocok untuk acara kantor, wisuda, dan pernikahan.',
   'Basic', 'Navy / Biru Tua',
   array['https://picsum.photos/seed/jas-navy-1/900/1200']),
  ('a0000000-0000-0000-0000-000000000005',
   'Atasan Brokat Putih',
   'Atasan brokat putih dengan detail bordir, serbaguna untuk berbagai acara semi-formal.',
   'Basic', 'Putih',
   array['https://picsum.photos/seed/brokat-putih-1/900/1200'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Variants (size + stock) per product
-- ---------------------------------------------------------------------------
insert into public.product_variants (product_id, size, total_stock) values
  ('a0000000-0000-0000-0000-000000000001', 'S', 2),
  ('a0000000-0000-0000-0000-000000000001', 'M', 3),
  ('a0000000-0000-0000-0000-000000000001', 'L', 2),
  ('a0000000-0000-0000-0000-000000000001', 'XL', 1),
  ('a0000000-0000-0000-0000-000000000002', 'S', 1),
  ('a0000000-0000-0000-0000-000000000002', 'M', 2),
  ('a0000000-0000-0000-0000-000000000002', 'L', 2),
  ('a0000000-0000-0000-0000-000000000003', 'S', 2),
  ('a0000000-0000-0000-0000-000000000003', 'M', 3),
  ('a0000000-0000-0000-0000-000000000003', 'L', 2),
  ('a0000000-0000-0000-0000-000000000004', 'M', 2),
  ('a0000000-0000-0000-0000-000000000004', 'L', 2),
  ('a0000000-0000-0000-0000-000000000004', 'XL', 1),
  ('a0000000-0000-0000-0000-000000000005', 'S', 2),
  ('a0000000-0000-0000-0000-000000000005', 'M', 2),
  ('a0000000-0000-0000-0000-000000000005', 'L', 1)
on conflict (product_id, size) do nothing;

-- ---------------------------------------------------------------------------
-- Product ↔ category links
-- ---------------------------------------------------------------------------
insert into public.product_categories (product_id, category_id)
select p.id, c.id
from public.products p
join public.categories c on
  (p.id = 'a0000000-0000-0000-0000-000000000001' and c.slug = 'gaun')
  or (p.id = 'a0000000-0000-0000-0000-000000000002' and c.slug = 'kebaya')
  or (p.id = 'a0000000-0000-0000-0000-000000000002' and c.slug = 'gaun')
  or (p.id = 'a0000000-0000-0000-0000-000000000003' and c.slug = 'gaun')
  or (p.id = 'a0000000-0000-0000-0000-000000000004' and c.slug = 'jas')
  or (p.id = 'a0000000-0000-0000-0000-000000000005' and c.slug = 'atasan')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Bootstrap users (auth.users + auth.identities + public.profiles)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change, is_sso_user, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'admin@viberent.id',
   extensions.crypt('Viberent@2026', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', '', false, false),
  ('00000000-0000-0000-0000-000000000000',
   'b0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'client@demo.id',
   extensions.crypt('Client@2026', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{}',
   now(), now(), '', '', '', '', false, false)
on conflict (id) do nothing;

-- identity_data must include 'sub' + 'email'; the `email` column on this
-- Supabase version is generated, so it is NOT inserted explicitly.
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000001',
   'b0000000-0000-0000-0000-000000000001',
   jsonb_build_object('sub', 'b0000000-0000-0000-0000-000000000001', 'email', 'admin@viberent.id'),
   'email', now(), now(), now()),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000002',
   jsonb_build_object('sub', 'b0000000-0000-0000-0000-000000000002', 'email', 'client@demo.id'),
   'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;

insert into public.profiles (id, full_name, role, phone) values
  ('b0000000-0000-0000-0000-000000000001', 'Admin Viberent', 'admin', '6281234567890'),
  ('b0000000-0000-0000-0000-000000000002', 'Siti Rahma', 'client', '6281234567788')
on conflict (id) do nothing;