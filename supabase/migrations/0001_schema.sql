-- ============================================================================
-- 0001_schema.sql — Core schema for Dress & Costume Rental (Viberent)
-- Tables, constraints, and indexes per prd/overview.md "Schema (reference
-- sketch)". No RLS here — that ships in 0002_rls_rpc.sql.
-- ============================================================================

-- pgcrypto lives in the `extensions` schema on Supabase; used by the seed
-- migration to hash bootstrap passwords (bcrypt).
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user; role drives which app the user lands in.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  role       text not null default 'client'
             check (role in ('admin', 'client')),
  phone      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- categories — catalog taxonomy (Gaun, Kebaya, Atasan, ...).
-- ---------------------------------------------------------------------------
create table public.categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

-- ---------------------------------------------------------------------------
-- products — rentable outfits. images is an ordered array of public URLs.
-- No price column: fees are negotiated offline via WhatsApp (see PRD).
-- ---------------------------------------------------------------------------
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  tier        text not null default 'Basic'
              check (tier in ('Basic', 'Premium')),
  color_theme text,
  images      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- product_categories — many-to-many link.
-- ---------------------------------------------------------------------------
create table public.product_categories (
  product_id  uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);

-- ---------------------------------------------------------------------------
-- product_variants — per-size stock rows (S/M/L/XL ...).
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  size        text not null,
  total_stock int  not null default 1 check (total_stock >= 0),
  unique (product_id, size)
);

-- ---------------------------------------------------------------------------
-- wishlists — favorites per client.
-- ---------------------------------------------------------------------------
create table public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- bookings — client requests + admin-confirmed rentals + admin date blocks.
--   status: pending | confirmed | rejected | blocked_by_admin
--   blocked rows: user_id is NULL (admin-created, no client).
--   Product FK intentionally has NO cascade: history must not silently
--   disappear if a product is later deleted (admin cleans up first).
-- ---------------------------------------------------------------------------
create table public.bookings (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  size       text not null,
  user_id    uuid references public.profiles (id) on delete set null,
  start_date date not null,
  end_date   date not null,
  status     text not null default 'pending'
             check (status in ('pending', 'confirmed', 'rejected', 'blocked_by_admin')),
  created_at timestamptz not null default now(),
  constraint bookings_dates_valid check (start_date <= end_date)
);

-- ---------------------------------------------------------------------------
-- settings — singleton row (id = 1) holding the public WhatsApp number.
-- ---------------------------------------------------------------------------
create table public.settings (
  id         int primary key default 1 check (id = 1),
  admin_phone text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (per PRD implementation notes).
-- ---------------------------------------------------------------------------
create index bookings_product_size_status_dates_idx
  on public.bookings (product_id, size, status, start_date, end_date);
create index product_variants_product_idx on public.product_variants (product_id);
create index wishlists_user_idx on public.wishlists (user_id);
create index bookings_user_idx on public.bookings (user_id);
