import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReceiptText } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../store/auth";
import type { BookingStatus, Product } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

/** PostgREST may embed a to-one relation as an object or a single-item array. */
function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

interface BookingRow {
  id: string;
  product_id: string;
  size: string;
  start_date: string;
  end_date: string;
  status: BookingStatus;
  created_at: string;
  products: Pick<Product, "title" | "images"> | null;
}

type RawBookingRow = Omit<BookingRow, "products"> & {
  products: Pick<Product, "title" | "images"> | Pick<Product, "title" | "images">[] | null;
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

function formatCreated(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const statusMeta: Record<
  BookingStatus,
  { label: string; variant: "warning" | "success" | "danger" }
> = {
  pending: { label: "Menunggu konfirmasi", variant: "warning" },
  confirmed: { label: "Dikonfirmasi", variant: "success" },
  rejected: { label: "Ditolak", variant: "danger" },
  blocked_by_admin: { label: "Tidak tersedia", variant: "danger" },
};

export default function MyBookings() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      if (!supabase) {
        if (active) {
          setError("Pesanan belum siap: konfigurasi backend belum lengkap. Hubungi admin.");
          setLoading(false);
        }
        return;
      }
      const { data, error: err } = await supabase
        .from("bookings")
        .select(
          "id, product_id, size, start_date, end_date, status, created_at, products(title, images)",
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (!active) return;

      if (err) {
        setError("Pesanan gagal dimuat. Periksa koneksi Anda, lalu coba lagi.");
        setLoading(false);
        return;
      }
      setRows(
        ((data ?? []) as unknown as RawBookingRow[]).map((r) => ({
          ...r,
          products: firstEmbed(r.products),
        })),
      );
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [uid, reloadKey]);

  const filteredRows = statusFilter === "all"
    ? rows
    : rows.filter((booking) => booking.status === statusFilter);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <ReceiptText className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
        <h2 className="font-heading text-xl font-semibold">Pesanan gagal dimuat</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        <Button onClick={() => setReloadKey((k) => k + 1)}>Coba lagi</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Pesanan Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pantau status setiap permintaan sewa Anda.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <ReceiptText className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          <h2 className="font-heading text-xl font-semibold">Belum ada pesanan</h2>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Saat Anda memesan kostum melalui halaman detail produk, riwayat dan statusnya akan
            muncul di sini.
          </p>
          <Link
            to="/"
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-soft transition-all duration-150 ease-out hover:bg-primary/90 active:scale-[0.97]"
          >
            Cari kostum
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-3 text-sm font-medium text-foreground">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                aria-label="Filter status pesanan"
                className="h-10 min-w-48 cursor-pointer rounded-lg border border-input bg-card py-2 pr-10 pl-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="all">Semua status</option>
                <option value="pending">Menunggu konfirmasi</option>
                <option value="confirmed">Dikonfirmasi</option>
                <option value="rejected">Ditolak</option>
              </select>
            </label>
            <span className="text-sm text-muted-foreground">{filteredRows.length} pesanan</span>
          </div>

          {filteredRows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Tidak ada pesanan dengan status ini.
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredRows.map((b) => {
            const meta = statusMeta[b.status];
            const image = b.products?.images?.[0];
            return (
              <li
                key={b.id}
                className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <Link
                  to={`/product/${b.product_id}`}
                  className="block h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                >
                  {image ? (
                    <img
                      src={image}
                      alt={b.products?.title ?? "Kostum"}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground/50">
                      —
                    </span>
                  )}
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/product/${b.product_id}`}
                      className="cursor-pointer font-heading text-sm font-semibold leading-snug text-foreground transition-colors duration-150 hover:text-primary"
                    >
                      {b.products?.title ?? "Produk"}
                    </Link>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatShort(b.start_date)} – {formatShort(b.end_date)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border border-border px-1.5 py-0.5 font-medium text-foreground">
                      Ukuran {b.size}
                    </span>
                    <span>Diajukan {formatCreated(b.created_at)}</span>
                  </div>
                  {b.status === "pending" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Admin akan mengonfirmasi permintaan Anda — pantau halaman ini.
                    </p>
                  )}
                  {b.status === "rejected" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Admin menolak permintaan ini. Coba tanggal lain atau hubungi kami via
                      WhatsApp.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
