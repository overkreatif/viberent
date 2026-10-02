import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useBookedRangesRefresh } from "../../lib/useBookedRangesRefresh";
import { useAuth } from "../../store/auth";
import type { BookedRange, Product, ProductVariant, Wishlist } from "../../lib/types";
import { ProductCard } from "../../components/ProductCard";
import { Button } from "../../components/ui/Button";

export default function Wishlist() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const [items, setItems] = useState<Wishlist[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [blocks, setBlocks] = useState<BookedRange[]>([]);
  useBookedRangesRefresh(setBlocks);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      if (!supabase) {
        if (active) {
          setError("Wishlist belum siap: konfigurasi backend belum lengkap. Hubungi admin.");
          setLoading(false);
        }
        return;
      }
      const [wRes, pRes, vRes, brRes] = await Promise.all([
        supabase
          .from("wishlists")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("product_variants").select("*"),
        supabase.rpc("get_booked_ranges"),
      ]);
      if (!active) return;

      const failed = [wRes, pRes, vRes, brRes].find((r) => r.error);
      if (failed) {
        setError("Wishlist gagal dimuat. Periksa koneksi Anda, lalu coba lagi.");
        setLoading(false);
        return;
      }

      setItems((wRes.data ?? []) as Wishlist[]);
      setProducts((pRes.data ?? []) as Product[]);
      setVariants((vRes.data ?? []) as ProductVariant[]);
      setBlocks((brRes.data ?? []) as BookedRange[]);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [uid, reloadKey]);

  const remove = useCallback(
    async (productId: string) => {
      if (!supabase || !uid) return;
      const item = items.find((w) => w.product_id === productId);
      if (!item) return;
      // Optimistic remove; restore the row if the delete fails.
      setItems((prev) => prev.filter((w) => w.product_id !== productId));
      const { error } = await supabase.from("wishlists").delete().eq("id", item.id);
      if (error) setItems((prev) => [...prev, item]);
      else window.dispatchEvent(new Event("rentfolio:wishlist-changed"));
    },
    [items, uid],
  );

  const productById = new Map(products.map((p) => [p.id, p]));
  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const v of variants) {
    const arr = variantsByProduct.get(v.product_id) ?? [];
    arr.push(v);
    variantsByProduct.set(v.product_id, arr);
  }
  const ordered = items
    .map((w) => productById.get(w.product_id))
    .filter((p): p is Product => Boolean(p));

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="aspect-[3/4] animate-pulse bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <Heart className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <h2 className="font-heading text-xl font-semibold">Wishlist gagal dimuat</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => setReloadKey((k) => k + 1)}>Coba lagi</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Wishlist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ordered.length
            ? `${ordered.length} kostum favorit Anda.`
            : "Simpan kostum favorit Anda di sini."}
        </p>
      </div>

      {ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <Heart className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          <h2 className="font-heading text-xl font-semibold">Wishlist masih kosong</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Ketuk ikon hati pada kostum di katalog untuk menyimpannya di sini, supaya mudah
            ditemukan kembali.
          </p>
          <Link
            to="/"
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition-all duration-150 ease-out hover:bg-primary/90 active:scale-[0.97]"
          >
            Jelajahi katalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-5 md:grid-cols-3">
          {ordered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              variants={variantsByProduct.get(p.id) ?? []}
              blocks={blocks}
              range={null}
              wishlisted
              onToggleWishlist={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
