import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { Placeholder } from "../../components/ui/Placeholder";

/* --------------------------------- types ---------------------------------- */

interface ClientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

/* --------------------------------- helpers -------------------------------- */

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "no-supabase")
    return "Konfigurasi Supabase belum lengkap. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Environment settings.";
  if (/42501|permission denied|violates row-level security/i.test(msg))
    return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  if (/failed to fetch|networkerror|load failed|typeerror/i.test(msg))
    return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
  return "Terjadi kendala. Silakan coba lagi.";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* ---------------------------------- page ---------------------------------- */

export default function Clients() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<ClientRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirmation, setEditPasswordConfirmation] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [deletingClient, setDeletingClient] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    passwordConfirmation?: string;
  }>({});
  const pageCount = Math.max(1, Math.ceil(clients.length / PAGE_SIZE));
  const visibleClients = clients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at")
        .eq("role", "client")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setClients((data ?? []) as ClientRow[]);
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
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  function validate(): boolean {
    const errors: {
      name?: string;
      email?: string;
      password?: string;
      passwordConfirmation?: string;
    } = {};
    if (!fullName.trim()) errors.name = "Nama lengkap wajib diisi.";
    if (!isValidEmail(email)) errors.email = "Format email tidak valid.";
    if (password.length < 6) errors.password = "Password minimal 6 karakter.";
    if (passwordConfirmation !== password) {
      errors.passwordConfirmation = "Konfirmasi password tidak sama.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    if (!supabase) {
      setFormError(
        "Konfigurasi Supabase belum lengkap. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Environment settings.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-client-account", {
        body: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || null,
        },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const ctx = (await error.context.json().catch(() => null)) as
            | { error?: string }
            | null;
          setFormError(ctx?.error ?? "Gagal membuat akun. Coba lagi.");
        } else if (error instanceof FunctionsRelayError) {
          setFormError("Jaringan bermasalah. Periksa koneksi lalu coba lagi.");
        } else if (error instanceof FunctionsFetchError) {
          setFormError(
            "Layanan tidak dapat dijangkau. Pastikan Edge Function create-client-account sudah di-deploy.",
          );
        } else {
          setFormError("Gagal membuat akun. Coba lagi.");
        }
        return;
      }
      const result = data as { ok?: boolean; email?: string } | null;
      setNotice(
        `Akun berhasil dibuat — ${result?.email ?? email.trim().toLowerCase()} sudah bisa langsung masuk.`,
      );
      setFullName("");
      setEmail("");
      setPassword("");
      setPasswordConfirmation("");
      setPhone("");
      setShowPassword(false);
      setFieldErrors({});
      setPage(1);
      void load();
    } catch (err) {
      setFormError(humanizeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(client: ClientRow) {
    setEditingClient(client);
    setEditName(client.full_name);
    setEditEmail(client.email);
    setEditPhone(client.phone ?? "");
    setEditPassword("");
    setEditPasswordConfirmation("");
    setEditError(null);
  }

  async function saveClient(e: FormEvent) {
    e.preventDefault();
    if (!editingClient || !supabase) return;
    if (!editName.trim() || !isValidEmail(editEmail)) {
      setEditError("Nama wajib diisi dan format email harus valid.");
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setEditError("Password baru minimal 6 karakter.");
      return;
    }
    if (editPassword !== editPasswordConfirmation) {
      setEditError("Password baru dan konfirmasi password tidak sama.");
      return;
    }
    setSavingClient(true);
    setEditError(null);
    try {
      const { data, error } = await supabase.functions.invoke("manage-client-account", {
        body: {
          action: "update",
          id: editingClient.id,
          full_name: editName.trim(),
          email: editEmail.trim().toLowerCase(),
          phone: editPhone.trim() || null,
          ...(editPassword ? { password: editPassword } : {}),
        },
      });
      if (error) {
        const ctx = error instanceof FunctionsHttpError
          ? (await error.context.json().catch(() => null)) as { error?: string } | null
          : null;
        throw new Error(ctx?.error ?? "Gagal memperbarui data klien.");
      }
      const result = data as { password_updated?: boolean } | null;
      if (editPassword && result?.password_updated !== true) {
        throw new Error(
          "Password belum dikonfirmasi oleh server. Deploy ulang Edge Function manage-client-account, lalu coba lagi.",
        );
      }
      setNotice("Data klien berhasil diperbarui.");
      setEditingClient(null);
      setEditPassword("");
      setEditPasswordConfirmation("");
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui data klien.");
    } finally {
      setSavingClient(false);
    }
  }

  async function deleteClient(client: ClientRow) {
    if (!supabase || !window.confirm(`Hapus akun ${client.full_name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    setDeletingClient(client.id);
    setLoadError(null);
    try {
      const { error } = await supabase.functions.invoke("manage-client-account", {
        body: { action: "delete", id: client.id },
      });
      if (error) {
        const ctx = error instanceof FunctionsHttpError
          ? (await error.context.json().catch(() => null)) as { error?: string } | null
          : null;
        throw new Error(ctx?.error ?? "Gagal menghapus akun klien.");
      }
      setNotice(`Akun ${client.full_name} berhasil dihapus.`);
      await load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Gagal menghapus akun klien.");
    } finally {
      setDeletingClient(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Klien</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buat akun klien — kredensial diberikan secara offline.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
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

      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        {/* Form */}
        <Card className="p-5 lg:sticky lg:top-8">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Buat Akun Baru
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Klien bisa langsung masuk setelah akun dibuat.
          </p>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-destructive"
              >
                {formError}
              </div>
            )}
            <Field
              label="Nama lengkap"
              placeholder="cth. Siti Rahma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={fieldErrors.name}
              required
            />
            <Field
              label="Email"
              type="email"
              placeholder="cth. siti@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              autoComplete="off"
              required
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="client-password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="client-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={
                    fieldErrors.password ? "client-password-error" : undefined
                  }
                  autoComplete="new-password"
                  className={`h-11 w-full rounded-lg border bg-card pr-11 pl-3.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60 ${
                    fieldErrors.password ? "border-destructive/70" : "border-input"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  aria-pressed={showPassword}
                  className="absolute top-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-r-lg text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p
                  id="client-password-error"
                  role="alert"
                  className="text-xs font-medium text-destructive"
                >
                  {fieldErrors.password}
                </p>
              )}
            </div>
            <Field
              label="Konfirmasi Password Baru"
              type="password"
              placeholder="Ulangi password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              error={fieldErrors.passwordConfirmation}
              autoComplete="new-password"
              required
            />
            <Field
              label="No. WhatsApp"
              type="tel"
              placeholder="cth. 081234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              hint="Opsional — nomor kontak klien."
            />
            <Button type="submit" className="w-full" loading={submitting}>
              {submitting ? undefined : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              Buat Akun Klien
            </Button>
          </form>
        </Card>

        {/* List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Daftar Klien
            </h2>
            {!loading && !loadError && (
              <Badge variant="neutral">{clients.length} klien</Badge>
            )}
          </div>

          {loading ? (
            <Card className="divide-y divide-border overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-1/4 rounded bg-muted" />
                  </div>
                  <div className="h-8 w-16 rounded bg-muted" />
                </div>
              ))}
            </Card>
          ) : loadError ? (
            <Card className="p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-destructive">
                  <Users className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    Gagal memuat data
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
                </div>
                <Button variant="outline" onClick={() => void load()}>
                  Coba Lagi
                </Button>
              </div>
            </Card>
          ) : clients.length === 0 ? (
            <Placeholder
              icon={Users}
              title="Belum ada akun klien"
              description="Buat akun klien pertama dengan formulir di samping. Klien bisa langsung masuk dan mulai memesan."
            />
          ) : (
            <>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-border">
                  {visibleClients.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 px-4 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-primary">
                      {initials(c.full_name) || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {c.full_name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.phone ? c.phone : "Belum ada nomor WA"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="neutral">Klien</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(c.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditing(c)}
                        aria-label={`Edit ${c.full_name}`}
                        title="Edit klien"
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteClient(c)}
                        disabled={deletingClient === c.id}
                        aria-label={`Hapus ${c.full_name}`}
                        title="Hapus klien"
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-destructive transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                  ))}
                </ul>
              </Card>
              {clients.length > PAGE_SIZE && (
                <nav
                  aria-label="Pagination daftar klien"
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
        </div>
      </div>

      {editingClient && (
        <Modal title="Edit Klien" onClose={() => setEditingClient(null)}>
          <form onSubmit={(e) => void saveClient(e)} className="space-y-4" noValidate>
            {editError && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-destructive">
                {editError}
              </div>
            )}
            <Field label="Nama lengkap" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            <Field label="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            <Field label="No. WhatsApp" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Field
              label="Password baru"
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Kosongkan jika tidak diubah"
              autoComplete="new-password"
              minLength={6}
            />
            <Field
              label="Konfirmasi Password Baru"
              type="password"
              value={editPasswordConfirmation}
              onChange={(e) => setEditPasswordConfirmation(e.target.value)}
              placeholder="Ulangi password baru"
              autoComplete="new-password"
              required={Boolean(editPassword)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>Batal</Button>
              <Button type="submit" loading={savingClient}>Simpan</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
