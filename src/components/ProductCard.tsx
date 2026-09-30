import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Heart, Shirt } from "lucide-react";
import { getAvailableSizes, type DateRange } from "../lib/availability";
import type { BookedRange, Product, ProductVariant } from "../lib/types";
import { Badge } from "./ui/Badge";

interface ProductCardProps {
  product: Product;
  variants: ProductVariant[];
  blocks: BookedRange[];
  range: DateRange | null;
  wishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
}

/** Catalog/wishlist card: image carousel, tier badge, wishlist heart, available sizes. */
export function ProductCard({
  product,
  variants,
  blocks,
  range,
  wishlisted,
  onToggleWishlist,
}: ProductCardProps) {
  const [idx, setIdx] = useState(0);
  const images = product.images?.length ? product.images : [];

  useEffect(() => {
    if (idx >= images.length) setIdx(Math.max(0, images.length - 1));
  }, [idx, images.length]);

  const availSizes = useMemo(
    () => getAvailableSizes(variants, blocks, range),
    [variants, blocks, range],
  );
  const extraSizes = availSizes.length - 3;

  const go = (dir: number) => setIdx((i) => (i + dir + images.length) % images.length);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow duration-200 hover:shadow-lift">
      <Link to={`/product/${product.id}`} aria-label={product.title} className="block">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {images.length ? (
            <img
              src={images[idx]}
              alt={product.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Shirt className="h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
            </div>
          )}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="Foto sebelumnya"
                className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-foreground shadow-soft transition-all duration-150 hover:bg-white active:scale-90"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="Foto berikutnya"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/85 text-foreground shadow-soft transition-all duration-150 hover:bg-white active:scale-90"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ke foto ${i + 1}`}
                    aria-current={i === idx}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIdx(i);
                    }}
                    className={`h-1.5 cursor-pointer rounded-full transition-all duration-150 ${
                      i === idx ? "w-4 bg-primary" : "w-1.5 bg-white/70 hover:bg-white"
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          <span className="absolute left-3 top-3 z-10">
            <Badge variant={product.tier === "Premium" ? "gold" : "neutral"}>
              {product.tier}
            </Badge>
          </span>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => onToggleWishlist(product.id)}
        aria-pressed={wishlisted}
        aria-label={
          wishlisted
            ? `Hapus ${product.title} dari wishlist`
            : `Tambah ${product.title} ke wishlist`
        }
        className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-soft transition-all duration-150 hover:scale-105 active:scale-90"
      >
        <Heart
          className={`h-4 w-4 transition-colors duration-150 ${
            wishlisted ? "fill-destructive text-destructive" : "text-foreground/60"
          }`}
          aria-hidden="true"
        />
      </button>

      <div className="p-3.5 sm:p-4">
        <Link
          to={`/product/${product.id}`}
          className="cursor-pointer font-heading text-base font-semibold leading-snug text-foreground transition-colors duration-150 hover:text-primary"
        >
          {product.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {product.color_theme && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full bg-muted-foreground/50"
                aria-hidden="true"
              />
              {product.color_theme}
            </span>
          )}
          {availSizes.slice(0, 3).map((s) => (
            <span
              key={s}
              className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {s}
            </span>
          ))}
          {extraSizes > 0 && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              +{extraSizes} ukuran
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
