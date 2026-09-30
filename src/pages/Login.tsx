import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "../store/auth";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field } from "../components/ui/Field";
import { FullPageLoader } from "../routes/guards";

export default function Login() {
  const { user, profile, profileError, loading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Once the profile is known, route to the right app.
  useEffect(() => {
    if (user && profile) {
      navigate(profile.role === "admin" ? "/admin" : "/", { replace: true });
    }
  }, [user, profile, navigate]);

  if (loading) return <FullPageLoader />;
  if (user && !profile) return <FullPageLoader />;

  if (user && profileError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="font-heading text-xl font-semibold">Akun tidak ditemukan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Profil Anda tidak ditemukan di sistem. Silakan hubungi admin untuk bantuan.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => void signOut()}>
            Keluar
          </Button>
        </Card>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Isi email dan kata sandi Anda.");
      return;
    }
    setSubmitting(true);
    const { error: err } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (err) setError(err);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-accent/5 blur-3xl"
      />

      <Card className="relative w-full max-w-md p-8 sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Viberent</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sewa gaun &amp; pakaian untuk acara spesial Anda.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="nama@contoh.id"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Field
            id="password"
            label="Kata sandi"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Masuk
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Kredensial login Anda diberikan oleh admin toko.
        </p>
      </Card>
    </div>
  );
}
