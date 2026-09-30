import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Heart, LayoutGrid, LogOut, ReceiptText, Sparkles } from "lucide-react";
import { useAuth } from "../store/auth";

const tabs = [
  { to: "/", label: "Katalog", icon: LayoutGrid, end: true },
  { to: "/wishlist", label: "Wishlist", icon: Heart, end: false },
  { to: "/my-bookings", label: "Pesanan Saya", icon: ReceiptText, end: false },
];

export function ClientLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

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
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-primary transition-transform duration-150 group-hover:scale-105">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">Viberent</span>
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Menu utama">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end} className={linkClass}>
                {tab.label}
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
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
