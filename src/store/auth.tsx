import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  /** Session bootstrap still running (initial page load). */
  loading: boolean;
  /** Fetching the profile row for the current user. */
  profileLoading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi. Hubungi admin.";
  if (m.includes("too many") || m.includes("rate limit"))
    return "Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.";
  if (m.includes("network") || m.includes("fetch"))
    return "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return "Gagal masuk. Silakan coba lagi.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  // Guards against a stale profile fetch resolving after a user switch.
  const lastUidRef = useRef<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    if (!supabase) return; // Degraded mode: backend not configured.
    lastUidRef.current = uid;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();
      if (lastUidRef.current !== uid) return; // stale response, ignore
      if (error) {
        setProfileError("Profil tidak ditemukan. Hubungi admin.");
        setProfile(null);
      } else {
        setProfile(data as Profile);
      }
    } finally {
      if (lastUidRef.current === uid) setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!supabase) {
        // Degraded mode: no backend, stay signed out.
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const session = data.session;
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) void loadProfile(session.user.id);
    })();

    if (!supabase) return () => {
      active = false;
    };

    // Sync overload — avoids the deadlock hazard of async callbacks.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) {
        void loadProfile(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        lastUidRef.current = null;
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Layanan belum dikonfigurasi. Hubungi admin." };
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: translateAuthError(error.message) };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    profileLoading,
    profileError,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
