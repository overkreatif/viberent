import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, LayoutDashboard, MessageCircle, ReceiptText, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { waLink } from "../../lib/wa";
import type { Booking, BookingStatus, Profile, Product } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

/** PostgREST may embed a to-one relation as an object or a single-item array. */
function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

interface BookingRow extends Booking {
  products: Pick<Product, "title" | "images"> | null;
  profiles: Pick<Profile, "full_name" | "phone"> | null;
}

type RawBookingRow = Omit<BookingRow, "products" | "profiles"> & {
  products: Pick<Product, "title" | "images"> | Pick<Product, "title" | "images">[] | null;
  profiles: Pick<Profile, "full_name" | "phone"> | Pick<Profile, "full_name" | "phone">[] | null;
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

const statusLabel: Record<BookingStatus, string> = {
  pending: "Menunggu",
  confirmed: "Dikonfirmasi",
  rejected: "Ditolak",
  blocked_by_admin: "Diblokir",
};

const statusOrder: Record<BookingStatus, number> = {
  pending: 0,
  confirmed: 1,
  rejected: 2,
  blocked_by_admin: 3,
};

export default function Dashboard() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Dashboard belum siap: konfigurasi backend belum lengkap.");
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("bookings")
      .select(
        "id, product_id, size, user_id, start_date, end_date, status, created_at, products(title, images), profiles(full_name, phone)",
      )
      .order("created_at", { ascending: false });
    if (err) {
      setError("Pesanan gagal dimuat. Periksa koneksi Anda, lalu coba lagi.");
    } else {
      setRows(
        ((data ?? []) as unknown as RawBookingRow[]).map((r) => ({
          ...r,
          products: firstEmbed(r.products),
          profiles: firstEmbed(r.profiles),
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime: any booking change (client request, admin action, new block) refreshes the list.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel("admin-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => void load(),
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [load]);

  const sorted = useMemo(
    () =>
      [...rows]
        .filter((b) => b.status !== "blocked_by_admin")
        .sort((a, b) => {
          const byStatus = statusOrder[a.status] - statusOrder[b.status];
          if (byStatus !== 0) return byStatus;
          return b.created_at.localeCompare(a.created_at);
        }),
    [rows],
  );

  const counts = useMemo(
    () => ({
      pending: sorted.filter((b) => b.status === "pending").length,
      confirmed: sorted.filter((b) => b.status === "confirmed").length,
      total: sorted.length,
    }),
    [sorted],
  );

  async function setStatus(id: string, status: "confirmed" | "rejected") {
    if (!supabase) return;
    setBusyId(id);
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      setError("Gagal memperbarui status. Coba lagi.");
      return;
    }
    void load();
  }

  const pending = sorted.filter((b) => b.status === "pending");
  const history = sorted
    .filter((b) => b.status !== "pending")
    .sort((a, b) =>
      b.start_date.localeCompare(a.start_date) ||
      b.end_date.localeCompare(a.end_date) ||
      b.created_at.localeCompare(a.created_at),
    );
  const filteredHistory = useMemo(
    () =>
      history.filter(
        (booking) =>
          (!historyStartDate || booking.end_date >= historyStartDate) &&
          (!historyEndDate || booking.start_date <= historyEndDate),
      ),
    [history, historyEndDate, historyStartDate],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-44 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola permintaan booking dari klien — diperbarui real-time.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-semibold text-foreground">{counts.pending}</p>
            <p className="text-xs font-medium text-muted-foreground">Menunggu konfirmasi</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-semibold text-foreground">{counts.confirmed}</p>
            <p className="text-xs font-medium text-muted-foreground">Dikonfirmasi</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-semibold text-foreground">{counts.total}</p>
            <p className="text-xs font-medium text-muted-foreground">Total pesanan</p>
          </div>
        </div>
      </div>

      {/* Pending requests */}
      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Permintaan masuk</h2>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <LayoutDashboard className="h-9 w-9 text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Tidak ada permintaan yang menunggu</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Saat klien mengirim permintaan sewa, pesanan akan muncul di sini secara real-time.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((b) => {
              const client = b.profiles;
              return (
                <li
                  key={b.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-heading text-base font-semibold text-foreground">
                          {b.products?.title ?? "Produk"}
                        </h3>
                        <Badge variant="warning">Menunggu</Badge>
                      </div>
                      <p className="mt-1 text-sm text-foreground">
                        {formatShort(b.start_date)} – {formatShort(b.end_date)}{" "}
                        <span className="text-muted-foreground">· Ukuran {b.size}</span>
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {client?.full_name ?? "Klien"} · {client?.phone ?? "—"} · Diajukan{" "}
                        {formatCreated(b.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {client?.phone && (
                        <a
                          href={waLink(
                            client.phone,
                            `Halo ${client.full_name}! Permintaan sewa *${b.products?.title ?? "kostum"}* (${b.size}, ${formatShort(b.start_date)} – ${formatShort(b.end_date)}) sedang diproses.`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Chat ${client.full_name} via WhatsApp`}
                          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        </a>
                      )}
                      <Button
                        variant="outline"
                        size="md"
                        loading={busyId === b.id}
                        onClick={() => void setStatus(b.id, "rejected")}
                        className="border-destructive/40 text-destructive hover:bg-red-50"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Tolak
                      </Button>
                      <Button
                        size="md"
                        loading={busyId === b.id}
                        onClick={() => void setStatus(b.id, "confirmed")}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Konfirmasi
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section>
          <h2 className="mb-3 font-heading text-lg font-semibold">Riwayat</h2>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Dari tanggal
              <input
                type="date"
                value={historyStartDate}
                max={historyEndDate || undefined}
                onChange={(event) => setHistoryStartDate(event.target.value)}
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Sampai tanggal
              <input
                type="date"
                value={historyEndDate}
                min={historyStartDate || undefined}
                onChange={(event) => setHistoryEndDate(event.target.value)}
                className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </label>
            {(historyStartDate || historyEndDate) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setHistoryStartDate("");
                  setHistoryEndDate("");
                }}
              >
                Reset filter
              </Button>
            )}
          </div>
          {filteredHistory.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Tidak ada riwayat pada rentang tanggal ini.
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredHistory.map((b) => {
                const client = b.profiles;
                const variant: "success" | "danger" | "neutral" =
                  b.status === "confirmed" ? "success" : b.status === "rejected" ? "danger" : "neutral";
                return (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {b.products?.title ?? "Produk"}{" "}
                        <span className="text-muted-foreground">· {b.size}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatShort(b.start_date)} – {formatShort(b.end_date)} ·{" "}
                        {client?.full_name ?? "Klien"}
                        {client?.phone ? ` / ${client.phone}` : ""}
                      </p>
                    </div>
                    <Badge variant={variant}>{statusLabel[b.status]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
