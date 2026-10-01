-- Rename demo/accessory one-size variants consistently in the UI and history.
update public.bookings
set size = 'All Size'
where size = 'Free';

update public.product_variants old_variant
set total_stock = old_variant.total_stock + all_size_variant.total_stock
from public.product_variants all_size_variant
where old_variant.size = 'Free'
  and all_size_variant.product_id = old_variant.product_id
  and all_size_variant.size = 'All Size';

delete from public.product_variants old_variant
using public.product_variants all_size_variant
where old_variant.size = 'Free'
  and all_size_variant.product_id = old_variant.product_id
  and all_size_variant.size = 'All Size';

update public.product_variants
set size = 'All Size'
where size = 'Free';