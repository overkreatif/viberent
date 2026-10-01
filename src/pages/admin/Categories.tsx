import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Category } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Placeholder } from "../../components/ui/Placeholder";

const PAGE_SIZE = 10;

/* --------------------------------- helpers -------------------------------- */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "no-supabase")
    return "Konfigurasi Supabase belum lengkap. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Environment settings.";
  if (/42501|permission denied|violates row-level security/i.test(msg))
    return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  if (/failed to fetch|networkerror|load failed|typeerror/i.test(msg))
    return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
  if (/23505|duplicate key|already exists/i.test(msg))
    return "Nama kategori sudah digunakan. Coba nama lain.";
  return "Terjadi kendala. Silakan coba lagi.";
}

/* ----------------------------- category form ------------------------------ */

function CategoryFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const slug = slugify(name);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nama kategori wajib diisi.");
      return;
    }
    if (!slug) {
      setError("Nama kategori hanya boleh huruf, angka, dan spasi.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      if (editing) {
        const { error: upErr } = await supabase
          .from("categories")
          .update({ name: trimmed, slug })
          .eq("id", editing.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabase
          .from("categories")
          .insert({ name: trimmed, slug });
        if (insErr) throw insErr;
      }
      onSaved();
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={editing ? "Edit Kategori" : "Tambah Kategori"}
      onClose={onClose}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {error}
          </div>
        )}
        <Field
          label="Nama kategori"
          placeholder="cth. Gaun, Kebaya, Jas…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3.5 py-2.5 text-sm">
          <span className="shrink-0 text-muted-foreground">Slug</span>
          <span className="truncate font-mono text-foreground/80">/{slug || "…"}</span>
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "Simpan Perubahan" : "Simpan Kategori"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------- page ---------------------------------- */

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const [catRes, usageRes] = await Promise.all([
        supabase.from("categories").select("id, name, slug").order("name"),
        supabase.from("product_categories").select("category_id"),
      ]);
      if (catRes.error) throw catRes.error;
      if (usageRes.error) throw usageRes.error;
      const counts: Record<string, number> = {};
      for (const row of usageRes.data ?? []) {
        counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
      }
      setUsageCounts(counts);
      setCategories((catRes.data ?? []) as Category[]);
    } catch (err) {
      setLoadError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.slug.includes(q),
    );
  }, [categories, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleCategories = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", confirmTarget.id);
      if (error) throw error;
      setConfirmTarget(null);
      setNotice("Kategori berhasil dihapus.");
      await load();
    } catch (err) {
      setDeleteError(humanizeError(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Kategori</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelompokkan produk agar mudah ditemukan klien.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Kategori
        </Button>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Tutup pemberitahuan"
            className="cursor-pointer rounded p-0.5 transition-colors duration-150 hover:text-emerald-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <Card className="p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau slug kategori…"
            aria-label="Cari kategori"
            className="h-11 w-full rounded-lg border border-input bg-card pl-10 pr-3.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
      </Card>

      {/* Body */}
      {loading ? (
        <Card className="divide-y divide-border overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-muted" />
                <div className="h-3 w-1/4 rounded bg-muted" />
              </div>
              <div className="h-8 w-20 rounded bg-muted" />
            </div>
          ))}
        </Card>
      ) : loadError ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-destructive">
              <Tags className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Gagal memuat data
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button variant="outline" onClick={() => void load()}>
              Coba Lagi
            </Button>
          </div>
        </Card>
      ) : categories.length === 0 ? (
        <Placeholder
          icon={Tags}
          title="Belum ada kategori"
          description="Buat kategori seperti Gaun, Kebaya, Atasan, dan lainnya untuk mengelompokkan produk di katalog."
        >
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Kategori Pertama
          </Button>
        </Placeholder>
      ) : filtered.length === 0 ? (
        <Placeholder
          icon={Search}
          title="Kategori tidak ditemukan"
          description="Tidak ada kategori yang cocok dengan pencarian. Coba kata kunci lain."
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {visibleCategories.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-muted/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-primary">
                  <Tags className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    /{c.slug}
                  </p>
                </div>
                <Badge variant={usageCounts[c.id] ? "gold" : "neutral"}>
                  {usageCounts[c.id] ?? 0} produk
                </Badge>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                    aria-label={`Edit ${c.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent/15 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmTarget(c);
                    }}
                    aria-label={`Hapus ${c.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-red-50 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
              ))}
            </ul>
          </Card>
          {filtered.length > PAGE_SIZE && (
            <nav
              aria-label="Pagination daftar kategori"
              className="flex items-center justify-between gap-3"
            >
              <p className="text-sm text-muted-foreground">
                Halaman {page} dari {pageCount}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((currentPage) => currentPage - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((currentPage) => currentPage + 1)}
                  disabled={page === pageCount}
                >
                  Berikutnya
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}

      {/* Form modal */}
      {formOpen && (
        <CategoryFormModal
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            setNotice(
              editing
                ? "Kategori berhasil diperbarui."
                : "Kategori berhasil ditambahkan.",
            );
            void load();
          }}
        />
      )}

      {/* Confirm delete modal */}
      {confirmTarget && (
        <Modal title="Hapus Kategori" onClose={() => setConfirmTarget(null)} className="max-w-md">
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground">
              Yakin ingin menghapus kategori{" "}
              <strong className="font-semibold">{confirmTarget.name}</strong>? Produk
              yang memakai kategori ini akan kehilangan labelnya.
            </p>
            {deleteError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-destructive"
              >
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmTarget(null)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
                loading={deleting}
              >
                Hapus
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
