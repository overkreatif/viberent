import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shirt,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Category, ProductTier } from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Placeholder } from "../../components/ui/Placeholder";

/* ---------------------------------- types --------------------------------- */

interface ProductRow {
  id: string;
  title: string;
  description: string | null;
  tier: ProductTier;
  color_theme: string | null;
  images: string[];
  created_at: string;
  product_categories: { category_id: string; categories: Category | null }[];
  product_variants: { id: string; size: string; total_stock: number }[];
}

interface VariantDraft {
  key: number;
  size: string;
  total_stock: string;
}

interface FormState {
  title: string;
  description: string;
  tier: ProductTier;
  color_theme: string;
  categoryIds: string[];
  images: string[];
  variants: VariantDraft[];
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  tier: "Basic",
  color_theme: "",
  categoryIds: [],
  images: [],
  variants: [],
};

const inputCls =
  "h-11 w-full rounded-lg border bg-card px-3.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

const textareaCls =
  "min-h-28 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

/* --------------------------------- helpers -------------------------------- */

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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
    return "Data sudah ada. Gunakan nama yang berbeda.";
  if (/no-images/i.test(msg)) return "Pilih file gambar terlebih dahulu.";
  return "Terjadi kendala. Silakan coba lagi.";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ------------------------------- product form ------------------------------ */

function ProductFormModal({
  editing,
  categories,
  onClose,
  onSaved,
}: {
  editing: ProductRow | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (!editing) return EMPTY_FORM;
    return {
      title: editing.title,
      description: editing.description ?? "",
      tier: editing.tier,
      color_theme: editing.color_theme ?? "",
      categoryIds: editing.product_categories?.map((pc) => pc.category_id) ?? [],
      images: editing.images ?? [],
      variants:
        editing.product_variants?.map((v, i) => ({
          key: i,
          size: v.size,
          total_stock: String(v.total_stock),
        })) ?? [],
    };
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const keyRef = useRef(100);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return "Nama produk wajib diisi.";
    if (form.variants.length === 0) return "Tambahkan minimal satu varian ukuran.";
    const sizes = new Set<string>();
    for (const v of form.variants) {
      const size = v.size.trim();
      if (!size) return "Setiap varian harus memiliki ukuran.";
      if (sizes.has(size)) return `Ukuran "${size}" ditulis dua kali. Gunakan ukuran yang berbeda.`;
      sizes.add(size);
      if (!/^\d+$/.test(v.total_stock.trim())) return `Stok untuk ukuran "${size}" harus berupa angka utuh.`;
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      setFormError(error);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        tier: form.tier,
        color_theme: form.color_theme.trim() || null,
        images: form.images.filter(Boolean),
      };
      const variants = form.variants.map((v) => ({
        size: v.size.trim(),
        total_stock: Number(v.total_stock),
      }));

      if (editing) {
        const { error: upErr } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editing.id);
        if (upErr) throw upErr;
        const { error: delPcErr } = await supabase
          .from("product_categories")
          .delete()
          .eq("product_id", editing.id);
        if (delPcErr) throw delPcErr;
        if (form.categoryIds.length > 0) {
          const { error: pcErr } = await supabase
            .from("product_categories")
            .insert(form.categoryIds.map((category_id) => ({ product_id: editing.id, category_id })));
          if (pcErr) throw pcErr;
        }
        const { error: delVErr } = await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", editing.id);
        if (delVErr) throw delVErr;
        const { error: vErr } = await supabase
          .from("product_variants")
          .insert(variants.map((v) => ({ product_id: editing.id, ...v })));
        if (vErr) throw vErr;
      } else {
        const { data: created, error: cErr } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (cErr) throw cErr;
        const productId = (created as { id: string }).id;
        if (form.categoryIds.length > 0) {
          const { error: pcErr } = await supabase
            .from("product_categories")
            .insert(form.categoryIds.map((category_id) => ({ product_id: productId, category_id })));
          if (pcErr) throw pcErr;
        }
        const { error: vErr } = await supabase
          .from("product_variants")
          .insert(variants.map((v) => ({ product_id: productId, ...v })));
        if (vErr) throw vErr;
      }
      onSaved();
    } catch (err) {
      setFormError(humanizeError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) {
      setCatError("Nama kategori wajib diisi.");
      return;
    }
    setCatBusy(true);
    setCatError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const { data, error } = await supabase
        .from("categories")
        .insert({ name, slug: slugify(name) })
        .select("id, name, slug")
        .single();
      if (error) throw error;
      const created = data as Category;
      categories.push(created);
      set("categoryIds", [...form.categoryIds, created.id]);
      setNewCategoryName("");
    } catch (err) {
      setCatError(humanizeError(err));
    } finally {
      setCatBusy(false);
    }
  }

  async function handleUploadFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setFormError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const urls: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const path = `products/${uid()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage
          .from("product-images")
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      if (urls.length === 0) throw new Error("no-images");
      set("images", [...form.images, ...urls]);
    } catch (err) {
      setFormError(humanizeError(err));
    } finally {
      setUploading(false);
    }
  }

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    set("images", [...form.images, url]);
    setImageUrl("");
  }

  return (
    <Modal
      title={editing ? "Edit Produk" : "Tambah Produk"}
      onClose={onClose}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {formError}
          </div>
        )}

        <Field
          label="Nama produk"
          placeholder="cth. Gaun Bridal Ivory"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tier-select" className="text-sm font-medium text-foreground">
              Tingkatan
            </label>
            <select
              id="tier-select"
              value={form.tier}
              onChange={(e) => set("tier", e.target.value as ProductTier)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="Basic">Basic</option>
              <option value="Premium">Premium</option>
            </select>
          </div>
          <Field
            label="Tema warna"
            placeholder="cth. Ivory & Gold"
            value={form.color_theme}
            onChange={(e) => set("color_theme", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="desc-textarea" className="text-sm font-medium text-foreground">
            Deskripsi
          </label>
          <textarea
            id="desc-textarea"
            className={textareaCls}
            placeholder="Ceritakan detail pakaian, bahan, atau catatan untuk penyewa…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        {/* Kategori */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Kategori</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const selected = form.categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    set(
                      "categoryIds",
                      selected
                        ? form.categoryIds.filter((id) => id !== c.id)
                        : [...form.categoryIds, c.id],
                    )
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {c.name}
                </button>
              );
            })}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada kategori. Tambahkan lewat form di bawah ini.
              </p>
            )}
          </div>
          <form
            onSubmit={handleAddCategory}
            className="flex flex-wrap items-center gap-2"
            aria-label="Tambah kategori baru"
          >
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nama kategori baru…"
              aria-label="Nama kategori baru"
              className={`${inputCls} !h-9 w-48 !text-xs`}
            />
            <Button type="submit" variant="outline" size="sm" loading={catBusy}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Tambah
            </Button>
            {catError && (
              <p role="alert" className="w-full text-xs font-medium text-destructive">
                {catError}
              </p>
            )}
          </form>
        </div>

        {/* Varian */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            Varian (Ukuran & Stok)
          </span>
          <div className="space-y-2">
            {form.variants.map((v) => (
              <div key={v.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={v.size}
                    onChange={(e) =>
                      set(
                        "variants",
                        form.variants.map((x) =>
                          x.key === v.key ? { ...x, size: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Ukuran (cth. M)"
                    aria-label={`Ukuran varian ${form.variants.indexOf(v) + 1}`}
                    className={inputCls}
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={v.total_stock}
                    onChange={(e) =>
                      set(
                        "variants",
                        form.variants.map((x) =>
                          x.key === v.key ? { ...x, total_stock: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Stok"
                    aria-label={`Stok varian ${form.variants.indexOf(v) + 1}`}
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => set("variants", form.variants.filter((x) => x.key !== v.key))}
                  aria-label={`Hapus varian ${v.size || form.variants.indexOf(v) + 1}`}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-red-50 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              set("variants", [...form.variants, { key: keyRef.current++, size: "", total_stock: "1" }])
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Varian
          </Button>
        </div>

        {/* Foto */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Foto produk</span>
          {form.images.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.images.map((url, i) => (
                <div
                  key={`${i}-${url}`}
                  className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img
                    src={url}
                    alt={`Foto ${i + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => set("images", form.images.filter((_, idx) => idx !== i))}
                    aria-label={`Hapus foto ${i + 1}`}
                    className="absolute right-1 top-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-foreground/70 text-white transition-colors duration-150 hover:bg-destructive"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
              )}
              {uploading ? "Mengunggah…" : "Unggah Foto"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleUploadFiles}
                disabled={uploading}
              />
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="…atau tempel URL gambar"
                aria-label="URL gambar"
                className={`${inputCls} !h-10 !text-xs`}
              />
              <Button type="button" variant="outline" size="sm" onClick={addImageUrl}>
                Tambah
              </Button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" loading={saving}>
            {editing ? "Simpan Perubahan" : "Simpan Produk"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------- page ---------------------------------- */

const PAGE_SIZE = 20;

export default function Products() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const [pRes, cRes] = await Promise.all([
        supabase
          .from("products")
          .select(
            "*, product_categories(category_id, categories(id, name, slug)), product_variants(id, size, total_stock)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name, slug").order("name"),
      ]);
      if (pRes.error) throw pRes.error;
      if (cRes.error) throw cRes.error;
      setProducts((pRes.data ?? []) as ProductRow[]);
      setCategories((cRes.data ?? []) as Category[]);
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

  // Reset ke halaman pertama saat filter berubah.
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const matchTitle = !q || p.title.toLowerCase().includes(q);
      const matchCat =
        categoryFilter === "all" ||
        (p.product_categories ?? []).some((pc) => pc.category_id === categoryFilter);
      return matchTitle && matchCat;
    });
  }, [products, search, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(product: ProductRow) {
    setEditing(product);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const { count, error: cntErr } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("product_id", confirmTarget.id);
      if (cntErr) throw cntErr;
      if (count && count > 0) {
        setDeleteError(
          "Produk ini memiliki riwayat booking, jadi tidak bisa dihapus. Hapus atau batalkan booking-nya terlebih dahulu.",
        );
        return;
      }
      const { error } = await supabase.from("products").delete().eq("id", confirmTarget.id);
      if (error) throw error;
      setConfirmTarget(null);
      setNotice("Produk berhasil dihapus.");
      await load();
    } catch (err) {
      setDeleteError(humanizeError(err));
    } finally {
      setDeleting(false);
    }
  }

  const totalStock = (p: ProductRow) =>
    (p.product_variants ?? []).reduce((sum, v) => sum + v.total_stock, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Produk</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola koleksi pakaian, varian ukuran, stok, dan foto.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Tambah Produk
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama produk…"
              aria-label="Cari nama produk"
              className={`${inputCls} pl-10`}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter kategori"
            className={`${inputCls} cursor-pointer sm:w-56`}
          >
            <option value="all">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="shrink-0 text-sm text-muted-foreground">
            {filtered.length} produk
          </p>
        </div>
      </Card>

      {/* Body */}
      {loading ? (
        <Card className="divide-y divide-border overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 p-4">
              <div className="h-14 w-11 shrink-0 rounded-lg bg-muted" />
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
              <Shirt className="h-6 w-6" aria-hidden="true" />
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
      ) : products.length === 0 ? (
        <Placeholder
          icon={Shirt}
          title="Belum ada produk"
          description="Katalog masih kosong. Tambahkan produk pertama untuk mulai menampilkan koleksi pakaian kepada penyewa."
        >
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah Produk Pertama
          </Button>
        </Placeholder>
      ) : filtered.length === 0 ? (
        <Placeholder
          icon={Search}
          title="Produk tidak ditemukan"
          description="Tidak ada produk yang cocok dengan pencarian atau filter kategori saat ini. Coba ubah kata kunci atau pilih kategori lain."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Produk
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Kategori
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Varian / Stok
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Ditambahkan
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map((p) => (
                  <tr key={p.id} className="transition-colors duration-150 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt=""
                            className="h-14 w-11 shrink-0 rounded-lg object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Shirt className="h-5 w-5" aria-hidden="true" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{p.title}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant={p.tier === "Premium" ? "gold" : "neutral"}>
                              {p.tier}
                            </Badge>
                            {p.color_theme && (
                              <span className="text-xs text-muted-foreground">
                                {p.color_theme}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex max-w-52 flex-wrap gap-1">
                        {(p.product_categories ?? []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          p.product_categories.map((pc) => (
                            <Badge key={pc.category_id} variant="outline">
                              {pc.categories?.name ?? "?"}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground">
                        {p.product_variants?.length ?? 0} varian · {totalStock(p)} stok
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(p.product_variants ?? [])
                          .map((v) => `${v.size} (${v.total_stock})`)
                          .join(", ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.title}`}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent/15 hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setConfirmTarget(p);
                          }}
                          aria-label={`Hapus ${p.title}`}
                          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-red-50 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
              <p className="text-muted-foreground">
                Menampilkan {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)} dari {filtered.length} produk
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Sebelumnya
                </Button>
                <span className="inline-flex items-center px-2 text-muted-foreground">
                  {safePage} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage(safePage + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Form modal */}
      {formOpen && (
        <ProductFormModal
          editing={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            setNotice(editing ? "Produk berhasil diperbarui." : "Produk berhasil ditambahkan.");
            void load();
          }}
        />
      )}

      {/* Confirm delete modal */}
      {confirmTarget && (
        <Modal title="Hapus Produk" onClose={() => setConfirmTarget(null)} className="max-w-md">
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground">
              Yakin ingin menghapus{" "}
              <strong className="font-semibold">{confirmTarget.title}</strong>? Tindakan ini
              tidak bisa dibatalkan dan akan menghapus varian serta referensi wishlist-nya.
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
