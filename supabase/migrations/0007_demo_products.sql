-- ============================================================================
-- 0007_demo_products.sql — 200 demo products for catalog demo (idempotent)
--   * 200 products with ids c0000000-... (no collision with seed ids a...)
--   * 12 category-combo patterns: singles, pairs, and a triple
--   * every product gets a unique title (name + style + color)
--   * size variants (S/M/L/XL or Free) with small stock so availability
--     checks and bookings behave realistically
--   * 2 picsum placeholder images per product
-- Re-running is safe: every insert uses ON CONFLICT DO NOTHING.
-- ============================================================================

with
gen as (
  select i as idx,
         (i - 1) % 12 as combo,
         (i - 1) % 10 + 1 as name_ord,
         (i - 1) % 11 + 1 as style_ord,
         (i - 1) % 24 + 1 as color_ord,
         case when (i - 1) % 3 = 0 then 'Premium' else 'Basic' end as tier
  from generate_series(1, 200) as i
),
combos(combo, slugs) as (
  values
    (0,  array['gaun']::text[]),
    (1,  array['kebaya']::text[]),
    (2,  array['atasan','bawahan']::text[]),
    (3,  array['jas']::text[]),
    (4,  array['gaun','kebaya']::text[]),
    (5,  array['atasan']::text[]),
    (6,  array['gaun','aksesoris']::text[]),
    (7,  array['bawahan']::text[]),
    (8,  array['kebaya','aksesoris']::text[]),
    (9,  array['jas','atasan']::text[]),
    (10, array['gaun','kebaya','aksesoris']::text[]),
    (11, array['aksesoris']::text[])
),
names(cat, n, name) as (
  values
    ('gaun', 1, 'Gaun Bridesmaid'), ('gaun', 2, 'Gaun Pesta'), ('gaun', 3, 'Gaun Malam'),
    ('gaun', 4, 'Gaun Wisuda'), ('gaun', 5, 'Gaun Panjang'), ('gaun', 6, 'Gaun Strapless'),
    ('gaun', 7, 'Gaun A-Line'), ('gaun', 8, 'Gaun Ball Gown'), ('gaun', 9, 'Gaun Payet'), ('gaun', 10, 'Gaun Satin'),
    ('kebaya', 1, 'Kebaya Modern'), ('kebaya', 2, 'Kebaya Brokat'), ('kebaya', 3, 'Kebaya Payet'),
    ('kebaya', 4, 'Kebaya Encim'), ('kebaya', 5, 'Kebaya Kartini'), ('kebaya', 6, 'Kebaya Kutubaru'),
    ('kebaya', 7, 'Kebaya Songket'), ('kebaya', 8, 'Kebaya Tulle'), ('kebaya', 9, 'Kebaya Kutu Baru'), ('kebaya', 10, 'Kebaya Satin'),
    ('atasan', 1, 'Atasan Brokat'), ('atasan', 2, 'Atasan Satin'), ('atasan', 3, 'Kemeja Formal'),
    ('atasan', 4, 'Blouse Pesta'), ('atasan', 5, 'Atasan Payet'), ('atasan', 6, 'Atasan Tulle'),
    ('atasan', 7, 'Kemeja Putih'), ('atasan', 8, 'Atasan Lace'), ('atasan', 9, 'Atasan Organza'), ('atasan', 10, 'Atasan Chiffon'),
    ('bawahan', 1, 'Rok A-Line'), ('bawahan', 2, 'Rok Plisket'), ('bawahan', 3, 'Rok Pesta'),
    ('bawahan', 4, 'Celana Formal'), ('bawahan', 5, 'Rok Payet'), ('bawahan', 6, 'Rok Maxi'),
    ('bawahan', 7, 'Celana Kain'), ('bawahan', 8, 'Rok Lilit'), ('bawahan', 9, 'Rok Tulle'), ('bawahan', 10, 'Celana Chino'),
    ('jas', 1, 'Jas Formal'), ('jas', 2, 'Jas Tuxedo'), ('jas', 3, 'Jas Navy'),
    ('jas', 4, 'Jas Hitam'), ('jas', 5, 'Jas Krem'), ('jas', 6, 'Jas Slim Fit'),
    ('jas', 7, 'Jas Double-Breasted'), ('jas', 8, 'Jas Wol'), ('jas', 9, 'Jas Putih'), ('jas', 10, 'Jas Tweed'),
    ('aksesoris', 1, 'Bros Payet'), ('aksesoris', 2, 'Ikat Pinggang'), ('aksesoris', 3, 'Selendang'),
    ('aksesoris', 4, 'Sarung Tangan'), ('aksesoris', 5, 'Mahkota'), ('aksesoris', 6, 'Veil'),
    ('aksesoris', 7, 'Kalung Mutiara'), ('aksesoris', 8, 'Bando'), ('aksesoris', 9, 'Sash'), ('aksesoris', 10, 'Kerudung Renda')
),
styles(ord, word) as (
  values
    (1,'Klasik'),(2,'Modern'),(3,'Elegant'),(4,'Romantis'),(5,'Minimalis'),(6,'Mewah'),
    (7,'Tradisional'),(8,'Chic'),(9,'Glam'),(10,'Vintage'),(11,'Soft')
),
colors(ord, word, theme) as (
  values
    (1, 'Sage', 'Sage / Hijau Muda'), (2, 'Gold', 'Gold / Emas'), (3, 'Hitam', 'Hitam'),
    (4, 'Navy', 'Navy / Biru Tua'), (5, 'Putih', 'Putih'), (6, 'Ivory', 'Ivory / Krem'),
    (7, 'Maroon', 'Maroon / Merah Marun'), (8, 'Burgundy', 'Burgundy'), (9, 'Rose', 'Rose Pink'),
    (10, 'Baby Blue', 'Baby Blue / Biru Bayi'), (11, 'Dusty Pink', 'Dusty Pink'), (12, 'Emerald', 'Emerald / Hijau Zamrud'),
    (13, 'Ungu', 'Ungu / Purple'), (14, 'Coklat', 'Cokelat Muda'), (15, 'Abu-abu', 'Abu-abu'),
    (16, 'Biru Muda', 'Biru Muda'), (17, 'Merah', 'Merah'), (18, 'Kuning', 'Kuning Pastel'),
    (19, 'Peach', 'Peach'), (20, 'Terracotta', 'Terracotta'), (21, 'Silver', 'Silver / Perak'),
    (22, 'Mocca', 'Mocca'), (23, 'Mustard', 'Mustard / Kuning'), (24, 'Fuchsia', 'Fuchsia / Pink Terang')
),
meta as (
  select g.idx,
         g.tier,
         c.slugs[1] as primary_cat,
         c.slugs as slugs,
         nm.name || ' ' || st.word || ' ' || col.word as title,
         col.theme as color_theme,
         ('c0000000-0000-0000-0000-' || lpad(to_hex(g.idx), 12, '0'))::uuid as pid
  from gen g
  join combos c on c.combo = g.combo
  join names nm on nm.cat = c.slugs[1] and nm.n = g.name_ord
  join styles st on st.ord = g.style_ord
  join colors col on col.ord = g.color_ord
),
variants_inserted as (
  insert into public.product_variants (product_id, size, total_stock)
  select m.pid, s.size, s.stock
  from meta m
  cross join lateral (values
    ('S', 1 + (m.idx % 3)),
    ('M', 1 + ((m.idx + 1) % 3)),
    ('L', 1 + ((m.idx + 2) % 3)),
    ('XL', 1 + ((m.idx + 3) % 3))
  ) as s(size, stock)
  where m.primary_cat <> 'aksesoris'
  union all
  select m.pid, 'Free', 2 + (m.idx % 5)
  from meta m
  where m.primary_cat = 'aksesoris'
  on conflict (product_id, size) do nothing
),
cats_inserted as (
  insert into public.product_categories (product_id, category_id)
  select m.pid, c2.id
  from meta m
  join public.categories c2 on c2.slug = any(m.slugs)
  on conflict do nothing
)
insert into public.products (id, title, description, tier, color_theme, images)
select m.pid,
       m.title,
       format(
         case m.primary_cat
           when 'gaun' then 'Gaun elegan warna %s, siap menemani acara pernikahan, pesta, dan wisuda. Kondisi selalu terawat, tersedia dalam beberapa ukuran.'
           when 'kebaya' then 'Kebaya cantik warna %s dengan detail modern, cocok untuk lamaran, pernikahan, dan acara adat.'
           when 'atasan' then 'Atasan formal warna %s, mudah dipadupadankan untuk acara semi-formal dan formal.'
           when 'bawahan' then 'Bawahan rapi warna %s, nyaman dipadukan untuk tampilan formal yang rapi.'
           when 'jas' then 'Jas rapi warna %s, pas untuk acara kantor, wisuda, dan pernikahan.'
           else 'Aksesoris pelengkap warna %s untuk melengkapi penampilan formal Anda.'
         end,
         lower(m.color_theme)
       ),
       m.tier,
       m.color_theme,
       array[
         'https://picsum.photos/seed/vib-' || m.idx || '-1/900/1200',
         'https://picsum.photos/seed/vib-' || m.idx || '-2/900/1200'
       ]
from meta m
on conflict (id) do nothing;
