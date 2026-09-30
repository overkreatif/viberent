import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { Spinner } from "../components/ui/Spinner";

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Spinner className="h-7 w-7" />
      <p className="text-sm text-muted-foreground">Memuat…</p>
    </div>
  );
}

/** Requires a signed-in user; redirects to /login otherwise. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Requires a signed-in user with the given role; redirects to the user's home otherwise. */
export function RequireRole({ role }: { role: "admin" | "client" }) {
  const { user, profile, loading, profileLoading, profileError, signOut } = useAuth();

  if (loading || profileLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  if (profileError || !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="font-heading text-2xl font-semibold">Akun tidak ditemukan</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Profil Anda tidak ditemukan di sistem. Silakan hubungi admin untuk bantuan.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="cursor-pointer text-sm font-medium text-primary underline-offset-2 transition-colors duration-150 hover:underline"
        >
          Keluar
        </button>
      </div>
    );
  }

  const target = profile.role === "admin" ? "/admin" : "/";
  if (profile.role !== role) return <Navigate to={target} replace />;
  return <Outlet />;
}
