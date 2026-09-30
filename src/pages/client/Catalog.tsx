import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  RotateCcw,
  Shirt,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../store/auth";
import {
  activeDateRange,
  activeFilterCount,
  useFilterStore,
} from "../../store/filterStore";
import { getAvailableSizes, hasAvailableSize } from "../../lib/availability";
import type {
  BookedRange,
  Category,
  Product,
  ProductCategory,
  ProductTier,
  ProductVariant,
  Wishlist,
} from "../../lib/types";
import { ProductCard } from "../../components/ProductCard";
import { Button } from "../../components/ui/Button";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatShort(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 ease-out active:scale-[0.97] ${
        active
          ? "border-primary bg-primary text-primary-foreground shadow-soft"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-4">
      <h3 className="mb-2.5 text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function FilterPanel({
  options,
}: {
  options: { categories: Category[]; sizes: string[]; colors: string[] };
}) {
  const {
    startDate,
    endDate,
    tiers,
    categoryIds,
    sizes,
    colors,
    setDateRange,
    toggleTier,
    toggleCategory,
    toggleSize,
    toggleColor,
    reset,
  } = useFilterStore();
  const count = activeFilterCount({ startDate, endDate, tiers, categoryIds, sizes, colors });

  const dateInputClass =
    "h-10 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors duration-150 focus:border-primary";

  return (
    <div className="space-y-5">
      <FilterSection title="Tanggal sewa">
        <div className="grid w-full grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Dari</span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => {
                const v = e.target.value;
                setDateRange(v, endDate && endDate >= v ? endDate : v);
              }}
              className={dateInputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Sampai</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                const v = e.target.value;
                setDateRange(startDate && startDate <= v ? startDate : v, v);
              }}
              className={dateInputClass}
            />
          </label>
        </div>
        {startDate && endDate ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Hanya kostum dengan ukuran tersedia pada rentang tersebut yang ditampilkan.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tanpa tanggal, seluruh koleksi tampil. Pilih tanggal untuk melihat ketersediaan.
          </p>
        )}
      </FilterSection>

      <FilterSection title="Tier">
        {(["Basic", "Premium"] as ProductTier[]).map((t) => (
          <FilterChip key={t} label={t} active={tiers.includes(t)} onClick={() => toggleTier(t)} />
        ))}
      </FilterSection>

      {options.categories.length > 0 && (
        <FilterSection title="Kategori">
          {options.categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={categoryIds.includes(c.id)}
              onClick={() => toggleCategory(c.id)}
            />
          ))}
        </FilterSection>
      )}

      {options.sizes.length > 0 && (
        <FilterSection title="Ukuran">
          {options.sizes.map((s) => (
            <FilterChip key={s} label={s} active={sizes.includes(s)} onClick={() => toggleSize(s)} />
          ))}
        </FilterSection>
      )}

      {options.colors.length > 0 && (
        <FilterSection title="Warna">
          {options.colors.map((c) => (
            <FilterChip
              key={c}
              label={c}
              active={colors.includes(c)}
              onClick={() => toggleColor(c)}
            />
          ))}
        </FilterSection>
      )}

      {count > 0 && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-sm font-medium text-destructive transition-colors duration-150 hover:text-destructive/80"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Atur ulang filter
        </button>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      <div className="aspect-[3/4] animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Catalog page                                                        */
/* ------------------------------------------------------------------ */

export default function Catalog() {
  const { user } = useAuth();
  const {
    startDate,
    endDate,
    tiers,
    categoryIds,
    sizes,
    colors,
    setDateRange,
    reset,
  } = useFilterStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [blocks, setBlocks] = useState<BookedRange[]>([]);
  const [wishlistMap, setWishlistMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /* ------------------------------ data ------------------------------ */

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const uid = user?.id ?? "";

    void (async () => {
      if (!supabase) {
        if (active) {
          setError("Katalog belum siap: konfigurasi backend belum lengkap. Hubungi admin.");
          setLoading(false);
        }
        return;
      }
      const [pRes, vRes, cRes, pcRes, brRes, wRes] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("product_variants").select("*"),
        supabase.from("categories").select("*").order("name", { ascending: true }),
        supabase.from("product_categories").select("*"),
        supabase.rpc("get_booked_ranges"),
        supabase.from("wishlists").select("id, product_id").eq("user_id", uid),
      ]);
      if (!active) return;

      const failed = [pRes, vRes, cRes, pcRes, brRes, wRes].find((r) => r.error);
      if (failed) {
        setError("Katalog gagal dimuat. Periksa koneksi Anda, lalu coba lagi.");
        setLoading(false);
        return;
      }

      setProducts((pRes.data ?? []) as Product[]);
      setVariants((vRes.data ?? []) as ProductVariant[]);
      setCategories((cRes.data ?? []) as Category[]);
      setProductCategories((pcRes.data ?? []) as ProductCategory[]);
      setBlocks((brRes.data ?? []) as BookedRange[]);
      setWishlistMap(
        Object.fromEntries(((wRes.data ?? []) as Wishlist[]).map((w) => [w.product_id, w.id])),
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id, reloadKey]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const uid = user?.id;
      if (!supabase || !uid) return;
      const prev = wishlistMap;
      const existingId = prev[productId];

      if (existingId) {
        // Optimistic remove
        setWishlistMap((m) => {
          const next = { ...m };
          delete next[productId];
          return next;
        });
        const { error } = await supabase.from("wishlists").delete().eq("id", existingId);
        if (error) setWishlistMap(prev);
      } else {
        // Optimistic add
        setWishlistMap((m) => ({ ...m, [productId]: "pending" }));
        const { data, error } = await supabase
          .from("wishlists")
          .insert({ user_id: uid, product_id: productId })
          .select("id")
          .single();
        if (error) {
          setWishlistMap(prev);
          return;
        }
        setWishlistMap((m) => ({ ...m, [productId]: data.id }));
      }
    },
    [user?.id, wishlistMap],
  );

  /* --------------------------- derived state ----------------------- */

  const variantsByProduct = useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    for (const v of variants) {
      const arr = map.get(v.product_id) ?? [];
      arr.push(v);
      map.set(v.product_id, arr);
    }
    return map;
  }, [variants]);

  const categoryIdsByProduct = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const pc of productCategories) {
      const set = map.get(pc.product_id) ?? new Set<string>();
      set.add(pc.category_id);
      map.set(pc.product_id, set);
    }
    return map;
  }, [productCategories]);

  const allSizes = useMemo(
    () =>
      Array.from(new Set(variants.map((v) => v.size))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [variants],
  );

  const allColors = useMemo(
    () =>
      Array.from(new Set(products.map((p) => p.color_theme).filter((c): c is string => !!c))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [products],
  );

  const range = useMemo(() => activeDateRange({ startDate, endDate }), [startDate, endDate]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (tiers.length && !tiers.includes(p.tier)) return false;
      if (colors.length && !(p.color_theme && colors.includes(p.color_theme))) return false;
      const pcats = categoryIdsByProduct.get(p.id);
      if (categoryIds.length && !categoryIds.some((c) => pcats?.has(c))) return false;
      const vs = variantsByProduct.get(p.id) ?? [];
      if (!hasAvailableSize(vs, blocks, range)) return false;
      if (sizes.length) {
        const avail = getAvailableSizes(vs, blocks, range);
        if (!sizes.some((s) => avail.includes(s))) return false;
      }
      return true;
    });
  }, [products, tiers, colors, categoryIds, sizes, blocks, range, categoryIdsByProduct, variantsByProduct]);

  const filterCount = useMemo(
    () => activeFilterCount({ startDate, endDate, tiers, categoryIds, sizes, colors }),
    [startDate, endDate, tiers, categoryIds, sizes, colors],
  );

  /* --------------------------- drawer a11y ------------------------- */

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [drawerOpen]);

  const trapTab = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const panel = drawerRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* ------------------------------ render -------------------------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-44 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <Shirt className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <h2 className="font-heading text-xl font-semibold">Katalog gagal dimuat</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => setReloadKey((k) => k + 1)}>Coba lagi</Button>
      </div>
    );
  }

  const options = { categories, sizes: allSizes, colors: allColors };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Katalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gaun, kebaya, dan pakaian untuk momen spesial Anda.
          </p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {filtered.length} kostum
          {range ? " tersedia" : ""}
        </p>
      </div>

      {range && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-foreground">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Menampilkan kostum yang tersedia{" "}
            <strong>
              {formatShort(range.start)} – {formatShort(range.end)}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setDateRange("", "")}
            aria-label="Hapus rentang tanggal"
            className="ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent/20 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="mb-4 font-heading text-lg font-semibold">Filter</h2>
            <FilterPanel options={options} />
          </div>
        </aside>

        <div>
          {/* Mobile toolbar */}
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <Button
              ref={triggerRef}
              variant="outline"
              size="md"
              onClick={() => setDrawerOpen(true)}
              className="flex-1"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              Filter
              {filterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </Button>
            {range && (
              <button
                type="button"
                onClick={() => setDateRange("", "")}
                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <span className="font-medium">
                  {formatShort(range.start)} – {formatShort(range.end)}
                </span>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <Shirt className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
              <h2 className="font-heading text-xl font-semibold">Belum ada kostum yang cocok</h2>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Tidak ada item yang cocok dengan filter saat ini. Coba longgarkan rentang tanggal
                atau pilihan Anda.
              </p>
              {filterCount > 0 && (
                <Button variant="outline" onClick={reset}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Atur ulang filter
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3">
              {filtered.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  variants={variantsByProduct.get(p.id) ?? []}
                  blocks={blocks}
                  range={range}
                  wishlisted={!!wishlistMap[p.id]}
                  onToggleWishlist={toggleWishlist}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="filter-drawer-title"
        >
          <div
            className="absolute inset-0 animate-fade-in bg-foreground/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            tabIndex={-1}
            onKeyDown={trapTab}
            className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm animate-drawer-in flex-col bg-card shadow-lift focus:outline-none"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 id="filter-drawer-title" className="font-heading text-lg font-semibold">
                Filter
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  triggerRef.current?.focus();
                }}
                aria-label="Tutup filter"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <FilterPanel options={options} />
            </div>
            <div className="border-t border-border p-4">
              <Button size="lg" className="w-full" onClick={() => setDrawerOpen(false)}>
                Lihat {filtered.length} kostum
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
