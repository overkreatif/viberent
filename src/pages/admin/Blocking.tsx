import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CalendarDays, Info, Plus, Search, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { countBooked, type DateRange } from "../../lib/availability";
import type { BookedRange, Product, ProductVariant, Profile } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

/** PostgREST may embed a to-one relation as an object or a single-item array. */
function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

interface BlockRow {
  id: string;
  product_id: string;
  size: string;
  quantity: number;
  start_date: string;
  end_date: string;
  created_at: string;
  status: "pending" | "confirmed" | "blocked_by_admin";
  products: Pick<Product, "title"> | null;
  profiles: Pick<Profile, "full_name" | "phone"> | null;
}

type RawBlockRow = Omit<BlockRow, "products" | "profiles"> & {
  products: Pick<Product, "title"> | Pick<Product, "title">[] | null;
  profiles:
    | Pick<Profile, "full_name" | "phone">
    | Pick<Profile, "full_name" | "phone">[]
    | null;
};

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

const selectClass =
  "h-11 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30";
const dateInputClass =
  "h-11 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/30";

export default function Blocking() {
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [ranges, setRanges] = useState<BookedRange[]>([]); // inventory reservations for overlap warnings
  const [blocks, setBlocks] = useState<BlockRow[]>([]); // client reservations + manual blocks
  const [reloadKey, setReloadKey] = useState(0);
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showProductResults, setShowProductResults] = useState(false);
  const [size, setSize] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    void (async () => {
      if (!supabase) {
        if (active) {
          setMessage({ kind: "err", text: "Backend belum dikonfigurasi. Hubungi admin." });
          setLoading(false);
        }
        return;
      }
      const [pRes, vRes, rRes, bRes] = await Promise.all([
        supabase.from("products").select("id, title").order("title", { ascending: true }),
        supabase.from("product_variants").select("product_id, size"),
        supabase.rpc("get_booked_ranges"),
        supabase
          .from("bookings")
          .select("id, product_id, size, quantity, start_date, end_date, created_at, status, products(title), profiles(full_name, phone)")
          .in("status", ["pending", "confirmed", "blocked_by_admin"])
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;

      if ([pRes, vRes, rRes, bRes].some((r) => r.error)) {
        setMessage({ kind: "err", text: "Data gagal dimuat. Periksa koneksi Anda, lalu coba lagi." });
        setLoading(false);
        return;
      }

      setProducts((pRes.data ?? []) as Product[]);
      setVariants((vRes.data ?? []) as ProductVariant[]);
      setRanges((rRes.data ?? []) as BookedRange[]);
      setBlocks(
        ((bRes.data ?? []) as unknown as RawBlockRow[]).map((r) => ({
          ...r,
          products: firstEmbed(r.products),
          profiles: firstEmbed(r.profiles),
        })),
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel("admin-schedule-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => setReloadKey((current) => current + 1),
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const productVariants = useMemo(
    () => variants.filter((v) => v.product_id === productId),
    [variants, productId],
  );
  const matchingProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      `${product.title} ${product.id}`.toLowerCase().includes(query),
    );
  }, [products, productSearch]);

  // Keep the selected size valid when the product changes.
  useEffect(() => {
    if (productId && !productVariants.some((v) => v.size === size)) {
      setSize(productVariants[0]?.size ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, productVariants]);

  const range: DateRange | null =
    startDate && endDate ? { start: startDate, end: endDate } : null;
  const overlapCount =
    range && productId && size ? countBooked(ranges, productId, size, range) : 0;
  const formValid = Boolean(productId && size && range && startDate <= endDate);

  /** Refresh the confirmed/blocked ranges used for overlap warnings. */
  const refreshRanges = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("get_booked_ranges");
    if (!error) setRanges((data ?? []) as BookedRange[]);
  }, []);

  async function handleBlock() {
    if (!supabase || !formValid || !range) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("bookings").insert({
      product_id: productId,
      size,
      user_id: null,
      start_date: range.start,
      end_date: range.end,
      status: "blocked_by_admin",
    });
    setBusy(false);
    if (error) {
      setMessage({ kind: "err", text: "Gagal memblokir tanggal. Coba lagi." });
      return;
    }
    setMessage({
      kind: "ok",
      text: `${formatShort(range.start)} – ${formatShort(range.end)} untuk ukuran ${size} berhasil diblokir.`,
    });
    setStartDate("");
    setEndDate("");
    void refreshRanges();
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    setDeletingId(id);
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      setMessage({ kind: "err", text: "Gagal menghapus blokir. Coba lagi." });
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setMessage({ kind: "ok", text: "Blokir tanggal dihapus." });
    void refreshRanges();
  }

  const visibleBlocks = useMemo(
    () => blocks.filter((b) => b.product_id === productId),
    [blocks, productId],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Atur Jadwal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Blokir tanggal untuk laundry, perawatan, atau pemakaian di luar aplikasi.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : message.kind === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-red-200 bg-red-50 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold">Blokir rentang tanggal</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Produk</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                role="combobox"
                aria-label="Cari produk berdasarkan nama atau UUID"
                aria-autocomplete="list"
                aria-expanded={showProductResults}
                aria-controls="blocking-product-results"
                value={productSearch}
                onFocus={() => setShowProductResults(true)}
                onBlur={() => setShowProductResults(false)}
                onChange={(event) => {
                  setProductSearch(event.target.value);
                  setProductId("");
                  setSize("");
                  setShowProductResults(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowProductResults(false);
                }}
                placeholder="Cari nama atau UUID produk"
                className={`${selectClass} cursor-text pl-10`}
              />
              {showProductResults && (
                <div
                  id="blocking-product-results"
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lift"
                >
                  {matchingProducts.length > 0 ? (
                    matchingProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        role="option"
                        aria-selected={product.id === productId}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setProductId(product.id);
                          setProductSearch(product.title);
                          setSize("");
                          setShowProductResults(false);
                        }}
                        className="flex w-full cursor-pointer flex-col px-3 py-2 text-left transition-colors hover:bg-muted"
                      >
                        <span className="text-sm font-medium text-foreground">{product.title}</span>
                        <span className="font-mono text-xs text-muted-foreground">{product.id}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      Produk tidak ditemukan.
                    </p>
                  )}
                </div>
              )}
            </div>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Ukuran</span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={!productId}
              className={selectClass}
            >
              <option value="">{productId ? "Pilih ukuran" : "Pilih produk dulu"}</option>
              {productVariants.map((v) => (
                <option key={v.size} value={v.size}>
                  {v.size}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Dari</span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
              className={dateInputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Sampai</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className={dateInputClass}
            />
          </label>
        </div>

        {startDate && endDate && startDate > endDate && (
          <p className="mt-3 text-sm text-destructive">Tanggal akhir harus setelah tanggal mulai.</p>
        )}

        {range && overlapCount > 0 && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Rentang ini bertumpang tindih dengan {overlapCount} booking yang sudah
              dikonfirmasi/diblokir. Pastikan Anda memang ingin memblokirnya.
            </span>
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <Button
            size="md"
            loading={busy}
            disabled={!formValid}
            onClick={() => void handleBlock()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Blokir tanggal
          </Button>
          <span className="text-xs text-muted-foreground">
            Blokir mengurangi ketersediaan di katalog seperti booking yang dikonfirmasi.
          </span>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-heading text-lg font-semibold">Jadwal tidak tersedia</h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !productId ? (
          <p className="text-sm text-muted-foreground">
            Pilih produk di atas untuk melihat blokir aktifnya.
          </p>
        ) : visibleBlocks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Tidak ada booking atau blokir untuk produk ini</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Booking terkonfirmasi dan blokir manual akan muncul di sini.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleBlocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Ban className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {b.products?.title ?? "Produk"} ·{" "}
                      <span className="text-muted-foreground">{b.size} ({b.quantity} stok)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.status === "blocked_by_admin"
                        ? "Blocked by Admin"
                        : `${b.profiles?.full_name ?? "Klien"}${b.profiles?.phone ? ` / ${b.profiles.phone}` : ""}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShort(b.start_date)} – {formatShort(b.end_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      b.status === "pending"
                        ? "warning"
                        : b.status === "confirmed"
                          ? "success"
                          : "danger"
                    }
                  >
                    {b.status === "pending"
                      ? "Menunggu"
                      : b.status === "confirmed"
                        ? "Dikonfirmasi"
                        : "Diblokir"}
                  </Badge>
                  {b.status === "blocked_by_admin" && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(b.id)}
                      disabled={deletingId === b.id}
                      aria-label={`Hapus blokir ${b.start_date} – ${b.end_date}`}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-red-50 hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
