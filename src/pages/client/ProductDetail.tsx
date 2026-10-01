import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Info,
  MessageCircle,
  Shirt,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useBookedRangesRefresh } from "../../lib/useBookedRangesRefresh";
import { useAuth } from "../../store/auth";
import { useFilterStore } from "../../store/filterStore";
import {
  availableCount,
  isDateAvailable,
  type DateRange,
} from "../../lib/availability";
import { waLink } from "../../lib/wa";
import type {
  BookedRange,
  Category,
  Product,
  ProductCategory,
  ProductVariant,
} from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";

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

/** Add n days to a YYYY-MM-DD string using local time (no UTC drift). */
function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return format(new Date(y, m - 1, d + n), "yyyy-MM-dd");
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/* ------------------------------------------------------------------ */
/* Availability calendar                                               */
/* ------------------------------------------------------------------ */

function AvailabilityCalendar({
  month,
  onMonthChange,
  variants,
  blocks,
  selectedSize,
  range,
  onPick,
}: {
  month: Date;
  onMonthChange: (m: Date) => void;
  variants: ProductVariant[];
  blocks: BookedRange[];
  selectedSize: string | null;
  range: DateRange | null;
  onPick: (iso: string) => void;
}) {
  const variant = selectedSize ? variants.find((v) => v.size === selectedSize) : null;
  const todayIso = format(new Date(), "yyyy-MM-dd");
  const currentMonth = startOfMonth(new Date());

  const cells: Date[] = [];
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  for (let d = start; d <= end; d = addDays(d, 1)) cells.push(d);

  const available = (d: Date) => {
    const iso = format(d, "yyyy-MM-dd");
    if (iso < todayIso) return false;
    if (variant) return isDateAvailable(variant, blocks, iso);
    return variants.some((v) => isDateAvailable(v, blocks, iso));
  };

  const inRange = (d: Date) => {
    if (!range) return false;
    const iso = format(d, "yyyy-MM-dd");
    return iso >= range.start && iso <= range.end;
  };
  const isEndpoint = (d: Date) => {
    if (!range) return false;
    const iso = format(d, "yyyy-MM-dd");
    return iso === range.start || iso === range.end;
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold capitalize text-foreground">
          {format(month, "MMMM yyyy", { locale: idLocale })}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMonthChange(subMonths(month, 1))}
            disabled={month <= currentMonth}
            aria-label="Bulan sebelumnya"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label="Bulan berikutnya"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const avail = available(d);
          const otherMonth = !isSameMonth(d, month);
          const endpoint = isEndpoint(d);
          const selected = inRange(d);
          const dayClass = [
            "flex h-9 w-full items-center justify-center rounded-lg text-sm transition-colors duration-150",
            !avail
              ? "cursor-not-allowed text-muted-foreground/30 line-through decoration-muted-foreground/30"
              : "cursor-pointer",
            otherMonth && avail ? "text-muted-foreground/40 hover:bg-accent/40" : "",
            avail && selected && endpoint
              ? "bg-primary font-semibold text-primary-foreground shadow-soft"
              : "",
            avail && selected && !endpoint ? "bg-accent/50 font-medium text-primary" : "",
            avail && !selected && format(d, "yyyy-MM-dd") === todayIso
              ? "font-semibold text-primary ring-1 ring-primary/60"
              : "",
            avail && !selected && otherMonth === false
              ? "text-foreground hover:bg-accent/40"
              : "",
            avail && !selected && otherMonth ? "" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={iso}
              type="button"
              disabled={!avail}
              aria-disabled={!avail}
              aria-pressed={endpoint}
              aria-label={`${format(d, "d MMMM yyyy", { locale: idLocale })}${avail ? ", tersedia" : ", tidak tersedia"}`}
              onClick={() => onPick(iso)}
              className={dayClass}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-primary" aria-hidden="true" /> Terpilih
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-accent/50 ring-1 ring-accent" aria-hidden="true" />{" "}
          Dalam rentang
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-border bg-card" aria-hidden="true" />{" "}
          Tersedia
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-muted" aria-hidden="true" /> Terbooking
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product detail page                                                */
/* ------------------------------------------------------------------ */

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { startDate, endDate, setDateRange } = useFilterStore();
  const productId = id ?? "";
  const uid = user?.id ?? "";

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [blocks, setBlocks] = useState<BookedRange[]>([]);
  const [adminPhone, setAdminPhone] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistId, setWishlistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [galleryIdx, setGalleryIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  useBookedRangesRefresh(setBlocks);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Pre-fill the range from the catalog filters (persisted store) once.
  useEffect(() => {
    if (startDate && endDate) setRange({ start: startDate, end: endDate });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      if (!supabase) {
        if (active) {
          setError("Halaman belum siap: konfigurasi backend belum lengkap. Hubungi admin.");
          setLoading(false);
        }
        return;
      }
      const [pRes, vRes, cRes, pcRes, brRes, sRes, wRes] = await Promise.all([
        supabase.from("products").select("*").eq("id", productId).maybeSingle(),
        supabase.from("product_variants").select("*").eq("product_id", productId),
        supabase.from("categories").select("*").order("name", { ascending: true }),
        supabase
          .from("product_categories")
          .select("*")
          .eq("product_id", productId),
        supabase.rpc("get_booked_ranges"),
        supabase.from("settings").select("admin_phone").eq("id", 1).maybeSingle(),
        uid
          ? supabase
              .from("wishlists")
              .select("id")
              .eq("user_id", uid)
              .eq("product_id", productId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (!active) return;

      const failed = [pRes, vRes, cRes, pcRes, brRes, sRes, wRes].find((r) => r.error);
      if (failed) {
        setError("Detail produk gagal dimuat. Periksa koneksi Anda, lalu coba lagi.");
        setLoading(false);
        return;
      }

      const vs = (vRes.data ?? []) as ProductVariant[];
      const ranges = (brRes.data ?? []) as BookedRange[];
      const prefilled = startDate && endDate ? { start: startDate, end: endDate } : null;
      const defaultSize =
        vs.find((v) => availableCount(v, ranges, prefilled) > 0)?.size ?? vs[0]?.size ?? null;

      setProduct((pRes.data as Product | null) ?? null);
      setVariants(vs);
      setCategories((cRes.data ?? []) as Category[]);
      setProductCategories((pcRes.data ?? []) as ProductCategory[]);
      setBlocks(ranges);
      setAdminPhone(((sRes.data as { admin_phone: string | null } | null) ?? null)?.admin_phone ?? null);
      setWishlisted(Boolean(wRes.data));
      setWishlistId((wRes.data as { id: string } | null)?.id ?? null);
      setSelectedSize(defaultSize);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, uid]);

  const images = product?.images?.length ? product.images : [];
  useEffect(() => {
    if (galleryIdx >= images.length) setGalleryIdx(Math.max(0, images.length - 1));
  }, [galleryIdx, images.length]);

  const variant = useMemo(
    () => (selectedSize ? variants.find((v) => v.size === selectedSize) ?? null : null),
    [variants, selectedSize],
  );

  const categoryNames = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c.name]));
    return productCategories.map((pc) => byId.get(pc.category_id)).filter((n): n is string => Boolean(n));
  }, [categories, productCategories]);

  const invalidDates = useMemo(() => {
    if (!range || !variant) return [] as string[];
    const bad: string[] = [];
    for (let d = range.start; d <= range.end; d = addDaysIso(d, 1)) {
      if (!isDateAvailable(variant, blocks, d)) bad.push(d);
    }
    return bad;
  }, [range, variant, blocks]);

  const canBook = Boolean(range && selectedSize && variant && invalidDates.length === 0);
  const calendarRange = rangeStart
    ? { start: rangeStart, end: rangeStart }
    : range;

  const handlePick = useCallback(
    (iso: string) => {
      if (!rangeStart) {
        setRange(null);
        setRangeStart(iso);
        setDateRange("", "");
        return;
      }
      const next = iso < rangeStart
        ? { start: iso, end: rangeStart }
        : { start: rangeStart, end: iso };
      setRange(next);
      setRangeStart(null);
      setDateRange(next.start, next.end);
    },
    [rangeStart, setDateRange],
  );

  const clearRange = useCallback(() => {
    setRange(null);
    setRangeStart(null);
    setDateRange("", "");
  }, [setDateRange]);

  const toggleWishlist = useCallback(async () => {
    if (!supabase || !uid) return;
    const prev = { wishlisted, wishlistId };
    if (wishlistId) {
      setWishlisted(false);
      setWishlistId(null);
      const { error } = await supabase.from("wishlists").delete().eq("id", wishlistId);
      if (error) {
        setWishlisted(prev.wishlisted);
        setWishlistId(prev.wishlistId);
      }
    } else {
      setWishlisted(true);
      setWishlistId("pending");
      const { data, error } = await supabase
        .from("wishlists")
        .insert({ user_id: uid, product_id: productId })
        .select("id")
        .single();
      if (error) {
        setWishlisted(false);
        setWishlistId(null);
        return;
      }
      setWishlistId(data.id);
    }
  }, [uid, productId, wishlisted, wishlistId]);

  const waMessage = product
    ? `Halo Viberent! Saya tertarik dengan kostum *${product.title}* (${selectedSize ?? "ukuran apa pun"}). Apakah tersedia?`
    : "Halo Viberent!";
  const waBookingMessage =
    range && selectedSize && product
      ? `Halo Viberent! Saya ingin menyewa *${product.title}* ukuran *${selectedSize}* pada ${formatShort(range.start)} – ${formatShort(range.end)}. Mohon konfirmasi ketersediaannya. Terima kasih!`
      : "Halo Viberent!";

  async function handleSubmit() {
    if (!supabase || !range || !selectedSize || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.from("bookings").insert({
      product_id: productId,
      size: selectedSize,
      user_id: user.id,
      start_date: range.start,
      end_date: range.end,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      setSubmitError("Permintaan gagal dikirim. Coba lagi sebentar ya.");
      return;
    }
    setSubmitted(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSubmitError(null);
  }

  /* ------------------------------ render --------------------------- */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="aspect-[3/4] animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-3">
            <div className="h-7 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
            <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <Shirt className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <h2 className="font-heading text-xl font-semibold">Produk tidak ditemukan</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {error ?? "Kostum yang Anda cari tidak ada atau sudah dihapus."}
        </p>
        <Link
          to="/"
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition-all duration-150 ease-out hover:bg-primary/90 active:scale-[0.97]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke katalog
        </Link>
      </div>
    );
  }

  const remaining = variant ? availableCount(variant, blocks, range) : 0;

  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke katalog
      </Link>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Gallery */}
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted shadow-soft">
            {images.length ? (
              <img
                src={images[galleryIdx]}
                alt={`${product.title} — foto ${galleryIdx + 1}`}
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-muted">
                <Shirt className="h-14 w-14 text-muted-foreground/30" aria-hidden="true" />
              </div>
            )}
            <span className="absolute left-3 top-3">
              <Badge variant={product.tier === "Premium" ? "gold" : "neutral"}>
                {product.tier}
              </Badge>
            </span>
            {images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Tampilkan foto ${i + 1}`}
                    aria-current={i === galleryIdx}
                    onClick={() => setGalleryIdx(i)}
                    className={`h-1.5 cursor-pointer rounded-full transition-all duration-150 ${
                      i === galleryIdx ? "w-4 bg-primary" : "w-1.5 bg-white/70 hover:bg-white"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setGalleryIdx(i)}
                  aria-label={`Foto ${i + 1}`}
                  className={`h-16 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all duration-150 ${
                    i === galleryIdx
                      ? "border-primary"
                      : "border-transparent opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-heading text-2xl font-semibold leading-tight sm:text-3xl">
                {product.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {product.color_theme && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                    {product.color_theme}
                  </span>
                )}
                {categoryNames.map((n) => (
                  <Badge key={n} variant="outline">
                    {n}
                  </Badge>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void toggleWishlist()}
              aria-pressed={wishlisted}
              aria-label={
                wishlisted
                  ? `Hapus ${product.title} dari wishlist`
                  : `Tambah ${product.title} ke wishlist`
              }
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card shadow-soft transition-all duration-150 hover:scale-105 active:scale-90"
            >
              <Heart
                className={`h-5 w-5 transition-colors duration-150 ${
                  wishlisted ? "fill-destructive text-destructive" : "text-foreground/60"
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {product.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

          {/* Calendar */}
          <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg font-semibold">Ketersediaan</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Ketuk tanggal untuk memilih rentang sewa
                  {selectedSize ? ` untuk ukuran ${selectedSize}` : ""}.
                </p>
              </div>
              {(range || rangeStart) && (
                <button
                  type="button"
                  onClick={clearRange}
                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Hapus pilihan
                </button>
              )}
            </div>

            {rangeStart ? (
              <p className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-foreground">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Tanggal mulai: <strong>{formatShort(rangeStart)}</strong>. Pilih tanggal akhir.
                </span>
              </p>
            ) : range ? (
              <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm text-foreground">
                <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Rentang terpilih: {" "}
                  <strong>
                    {formatShort(range.start)} – {formatShort(range.end)}
                  </strong>
                  {variant ? ` · ${remaining} ${remaining === 1 ? "unit tersedia" : "unit tersedia"}` : ""}
                </span>
              </div>
            ) : (
              <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Pilih dua tanggal untuk membentuk rentang. Hari bertanda coret sudah terbooking.
              </p>
            )}

            <div className="max-w-md">
              <AvailabilityCalendar
                month={month}
                onMonthChange={setMonth}
                variants={variants}
                blocks={blocks}
                selectedSize={selectedSize}
                range={calendarRange}
                onPick={handlePick}
              />
            </div>
          </section>

          {/* Size picker */}
          <section className="mt-5">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Pilih ukuran</h2>
            {variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ukuran belum ditambahkan untuk kostum ini.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const left = availableCount(v, blocks, range);
                  const disabled = range ? left <= 0 : false;
                  return (
                    <button
                      key={v.size}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selectedSize === v.size}
                      onClick={() => setSelectedSize(v.size)}
                      className={`cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${
                        selectedSize === v.size
                          ? "border-primary bg-primary text-primary-foreground shadow-soft"
                          : "border-border bg-card text-foreground hover:border-primary/50"
                      }`}
                    >
                      {v.size}
                      <span
                        className={`ml-1.5 text-xs ${
                          selectedSize === v.size
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground"
                        }`}
                      >
                        {range ? `sisa ${left}` : `stok ${v.total_stock}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* CTA */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <Button
              size="lg"
              disabled={!canBook}
              onClick={() => setModalOpen(true)}
              className="min-w-44 flex-1 sm:flex-none"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {range ? "Pesan kostum" : "Pilih tanggal untuk memesan"}
            </Button>
            {adminPhone && (
              <a
                href={waLink(adminPhone, waMessage)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/40 px-5 text-base font-medium text-primary transition-all duration-150 ease-out hover:bg-primary/10 active:scale-[0.97]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Tanya via WhatsApp
              </a>
            )}
          </div>
          {range && invalidDates.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-sm text-destructive">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {invalidDates.length} tanggal dalam rentang sudah tidak tersedia untuk ukuran{" "}
                {selectedSize}. Pilih rentang lain.
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Booking modal */}
      {modalOpen && (
        <Modal title="Kirim permintaan sewa" onClose={closeModal}>
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-7 w-7" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-xl font-semibold">Permintaan terkirim!</h3>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Pesanan Anda untuk <strong>{product.title}</strong> ({selectedSize},{" "}
                {range ? `${formatShort(range.start)} – ${formatShort(range.end)}` : ""}) sudah
                tercatat dan menunggu konfirmasi admin. Selesaikan detail sewa via WhatsApp agar
                prosesnya lebih cepat.
              </p>
              {adminPhone && (
                <a
                  href={waLink(adminPhone, waBookingMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-5 text-base font-medium text-primary-foreground shadow-soft transition-all duration-150 ease-out hover:bg-primary/90 active:scale-[0.97]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Lanjutkan via WhatsApp
                </a>
              )}
              <Link
                to="/my-bookings"
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-medium text-primary transition-colors duration-150 hover:bg-primary/10"
              >
                Lihat pesanan saya
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <img
                  src={images[0]}
                  alt=""
                  className="h-16 w-12 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-semibold text-foreground">
                    {product.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Ukuran {selectedSize} ·{" "}
                    {range ? `${formatShort(range.start)} – ${formatShort(range.end)}` : "—"}
                  </p>
                </div>
              </div>

              <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                Admin akan mengonfirmasi permintaan Anda.
              </p>

              {submitError && (
                <p role="alert" className="mt-3 text-sm font-medium text-destructive">
                  {submitError}
                </p>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <Button
                  size="lg"
                  loading={submitting}
                  onClick={() => void handleSubmit()}
                  className="w-full"
                >
                  Kirim permintaan sewa
                </Button>
                <Button variant="ghost" onClick={closeModal} className="w-full">
                  Batal
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
