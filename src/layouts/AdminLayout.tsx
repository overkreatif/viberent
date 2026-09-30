import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarX2,
  LayoutDashboard,
  LogOut,
  Menu,
  Shirt,
  Sparkles,
  Tags,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../store/auth";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "Produk", icon: Shirt, end: false },
  { to: "/admin/blocking", label: "Atur Jadwal", icon: CalendarX2, end: false },
  { to: "/admin/categories", label: "Kategori", icon: Tags, end: false },
  { to: "/admin/clients", label: "Klien", icon: Users, end: false },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors duration-150 ${
    isActive
      ? "bg-accent/15 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;

/** Small count pill for the pending-bookings badge. */
function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground"
      aria-label={`${count} permintaan menunggu`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Admin nav links; the Dashboard item carries the live pending-bookings count. */
function NavList({ pendingCount }: { pendingCount: number }) {
  return (
    <>
      {navItems.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{item.label}</span>
          {item.to === "/admin" && pendingCount > 0 && <PendingBadge count={pendingCount} />}
        </NavLink>
      ))}
    </>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-primary">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">Viberent</span>
    </div>
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      type="button"
      onClick={onLogout}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Keluar
    </button>
  );
}

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Live count of pending booking requests (drives the Dashboard nav badge).
  const loadPendingCount = useCallback(async () => {
    if (!supabase) return;
    const { count, error } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (!error) setPendingCount(count ?? 0);
  }, []);

  useEffect(() => {
    void loadPendingCount();
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel("admin-pending-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        () => void loadPendingCount(),
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [loadPendingCount]);

  // Close the drawer whenever the route changes (link tapped inside it).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // While open: Escape closes, body scroll locks, focus moves into the dialog
  // and is trapped (Tab cycles within it); focus returns to the trigger on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => closeBtnRef.current?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
      menuBtnRef.current?.focus();
    };
  }, [drawerOpen]);

  async function handleLogout() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Menu admin">
          <NavList pendingCount={pendingCount} />
        </nav>
        <div className="space-y-1 border-t border-border p-3">
          <div className="px-3.5 py-2">
            <p className="truncate text-sm font-medium">{profile?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">Admin</p>
          </div>
          <LogoutButton onLogout={() => void handleLogout()} />
        </div>
      </aside>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu"
              aria-expanded={drawerOpen}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <PendingBadge count={pendingCount} />
          </div>
          <Brand />
          <span className="w-9" aria-hidden="true" />
        </header>

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-foreground/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu admin"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-drawer-in flex-col bg-card shadow-lift"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Brand />
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup menu"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Menu admin">
              <NavList pendingCount={pendingCount} />
            </nav>
            <div className="space-y-1 border-t border-border p-3">
              <div className="px-3.5 py-2">
                <p className="truncate text-sm font-medium">{profile?.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">Admin</p>
              </div>
              <LogoutButton onLogout={() => void handleLogout()} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
