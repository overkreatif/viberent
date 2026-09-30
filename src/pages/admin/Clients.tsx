import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, UserPlus, Users, X } from "lucide-react";
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
import { Placeholder } from "../../components/ui/Placeholder";

/* --------------------------------- types ---------------------------------- */

interface ClientRow {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
}

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (!supabase) throw new Error("no-supabase");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, created_at")
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
    const errors: { name?: string; email?: string; password?: string } = {};
    if (!fullName.trim()) errors.name = "Nama lengkap wajib diisi.";
    if (!isValidEmail(email)) errors.email = "Format email tidak valid.";
    if (password.length < 6) errors.password = "Password minimal 6 karakter.";
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
      setPhone("");
      setShowPassword(false);
      setFieldErrors({});
      void load();
    } catch (err) {
      setFormError(humanizeError(err));
    } finally {
      setSubmitting(false);
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
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {clients.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 px-4 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-primary">
                      {initials(c.full_name) || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {c.full_name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.phone ? c.phone : "Belum ada nomor WA"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant="neutral">Klien</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(c.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
