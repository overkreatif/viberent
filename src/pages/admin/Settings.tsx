import { useEffect, useState, type FormEvent } from "react";
import { Save, UserRoundCog } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../store/auth";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setEmail(user?.email ?? "");
  }, [user?.email]);

  useEffect(() => {
    setPhone(profile?.phone ?? "");
  }, [profile?.phone]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setNotice(null);
    if (!supabase || !user) {
      setErrorMessage("Layanan belum dikonfigurasi. Coba lagi nanti.");
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage("Format email tidak valid.");
      return;
    }
    if (password && password.length < 6) {
      setErrorMessage("Password minimal 6 karakter.");
      return;
    }
    if (password !== passwordConfirmation) {
      setErrorMessage("Password baru dan konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);
    try {
      const authUpdates: { email?: string; password?: string } = {};
      if (email.trim().toLowerCase() !== user.email?.toLowerCase()) {
        authUpdates.email = email.trim().toLowerCase();
      }
      if (password) authUpdates.password = password;
      if (Object.keys(authUpdates).length > 0) {
        const { error } = await supabase.auth.updateUser(authUpdates);
        if (error) throw error;
      }

      const normalizedPhone = phone.trim() || null;
      if (normalizedPhone !== (profile?.phone ?? null)) {
        const { error } = await supabase
          .from("profiles")
          .update({ phone: normalizedPhone })
          .eq("id", user.id);
        if (error) throw error;
        await refreshProfile();
      }

      setPassword("");
      setPasswordConfirmation("");
      setNotice(
        authUpdates.email
          ? "Perubahan tersimpan. Konfirmasi alamat email baru melalui email yang dikirim Supabase."
          : "Pengaturan akun berhasil diperbarui.",
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan pengaturan akun.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola kredensial dan nomor kontak admin.</p>
      </div>

      <Card className="max-w-2xl p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-primary">
            <UserRoundCog className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Akun Super Admin</h2>
            <p className="text-sm text-muted-foreground">Perubahan email dan password berlaku untuk akun login ini.</p>
          </div>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4" noValidate>
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-destructive">
              {errorMessage}
            </div>
          )}
          {notice && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
              {notice}
            </div>
          )}
          <Field label="Email login" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          <Field label="No. HP / WhatsApp" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
          <Field
            label="Password baru"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Kosongkan jika tidak diubah"
            autoComplete="new-password"
            minLength={6}
            hint="Minimal 6 karakter. Password lama tidak ditampilkan."
          />
          <Field
            label="Konfirmasi Password Baru"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
            required={Boolean(password)}
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="submit" loading={saving}>
              {saving ? undefined : <Save className="h-4 w-4" aria-hidden="true" />}
              Simpan Pengaturan
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}