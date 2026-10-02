import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Heart, LayoutGrid, LogOut, ReceiptText } from "lucide-react";
import { useAuth } from "../store/auth";
import { Logo } from "../components/ui/Logo";
import { supabase } from "../lib/supabase";

const tabs = [
  { to: "/", label: "Katalog", icon: LayoutGrid, end: true },
  { to: "/wishlist", label: "Wishlist", icon: Heart, end: false },
  { to: "/my-bookings", label: "Pesanan Saya", icon: ReceiptText, end: false },
];

export function ClientLayout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    if (!user || !supabase) {
      setWishlistCount(0);
      return;
    }

    let active = true;
    const client = supabase;
    const loadWishlistCount = async () => {
      const { count, error } = await client
        .from("wishlists")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (active && !error) setWishlistCount(count ?? 0);
    };
    const refresh = () => void loadWishlistCount();
    void loadWishlistCount();

    const channel = client
      .channel(`client-wishlist-count-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlists", filter: `user_id=eq.${user.id}` },
        () => void loadWishlistCount(),
      )
      .subscribe();
    const interval = window.setInterval(refresh, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("rentfolio:wishlist-changed", refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("rentfolio:wishlist-changed", refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void client.removeChannel(channel);
    };
  }, [user?.id]);

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer ${
      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <NavLink to="/" className="group flex items-center gap-2 cursor-pointer">
            <Logo />
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Menu utama">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={linkClass}>
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  {tab.to === "/wishlist" && wishlistCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-primary">
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
              {profile?.full_name}
            </span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              aria-label="Keluar"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 md:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Menu utama"
      >
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `flex flex-1 cursor-pointer flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-150 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  {tab.to === "/wishlist" && wishlistCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-primary">
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </span>
                  )}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
