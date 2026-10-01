import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Map common Auth API errors to human-readable Bahasa Indonesia messages. */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("already been registered") ||
    m.includes("already exists") ||
    m.includes("duplicate")
  ) {
    return "Email sudah terdaftar.";
  }
  if (m.includes("password should be at least")) {
    return "Password terlalu pendek (minimal 6 karakter).";
  }
  if (m.includes("invalid email") || m.includes("malformed email")) {
    return "Format email tidak valid.";
  }
  return "Gagal membuat akun. Coba lagi.";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1) The caller must be a signed-in user (JWT verified against the Auth server).
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Tidak terautentikasi." }, 401);

    const anonClient = createClient(supabaseUrl, anonKey);
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);
    if (userError || !user) return json({ error: "Tidak terautentikasi." }, 401);

    // 2) Only an admin may create client accounts.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError || profile?.role !== "admin") {
      return json({ error: "Akses ditolak. Hanya admin yang dapat membuat akun klien." }, 403);
    }

    // 3) Validate payload.
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const fullName = String(body?.full_name ?? "").trim();
    const phone = body?.phone ? String(body.phone).trim() : null;

    if (!email || !password || !fullName) {
      return json({ error: "Nama, email, dan password wajib diisi." }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password minimal 6 karakter." }, 400);
    }

    // 4) Create the auth user with email pre-confirmed so the client can log in immediately.
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone ?? "" },
    });
    if (createError || !created.user) {
      return json({ error: friendlyError(createError?.message ?? "") }, 400);
    }

    // 5) Create the matching profiles row (role = 'client').
    const { error: insertError } = await adminClient
      .from("profiles")
      .insert({ id: created.user.id, full_name: fullName, email, role: "client", phone });

    if (insertError) {
      // Roll back the auth user so no orphaned login remains.
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: "Gagal menyimpan profil klien. Coba lagi." }, 500);
    }

    return json({ ok: true, id: created.user.id, email }, 201);
  } catch {
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});
