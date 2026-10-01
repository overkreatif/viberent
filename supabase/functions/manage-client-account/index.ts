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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Tidak terautentikasi." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !user) return json({ error: "Tidak terautentikasi." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (callerProfileError || callerProfile?.role !== "admin") {
      return json({ error: "Akses ditolak. Hanya admin yang dapat mengelola akun klien." }, 403);
    }

    const body = await req.json();
    const id = String(body?.id ?? "");
    const action = String(body?.action ?? "");
    if (!id || !["update", "delete"].includes(action)) {
      return json({ error: "Permintaan tidak valid." }, 400);
    }

    const { data: target, error: targetError } = await adminClient
      .from("profiles")
      .select("id, role, full_name, phone")
      .eq("id", id)
      .single();
    if (targetError || target?.role !== "client") {
      return json({ error: "Akun klien tidak ditemukan." }, 404);
    }

    if (action === "delete") {
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) return json({ error: "Gagal menghapus akun klien." }, 400);
      return json({ ok: true });
    }

    const fullName = String(body?.full_name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Nama dan format email yang valid wajib diisi." }, 400);
    }
    if (password && password.length < 6) {
      return json({ error: "Password minimal 6 karakter." }, 400);
    }

    const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
      user_metadata: { full_name: fullName, phone: phone ?? "" },
    });
    if (authError) {
      if (/already|registered|exists|duplicate/i.test(authError.message)) {
        return json({ error: "Email sudah digunakan akun lain." }, 400);
      }
      return json({ error: "Gagal memperbarui kredensial akun klien." }, 400);
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ full_name: fullName, email, phone })
      .eq("id", id);
    if (profileError) return json({ error: "Email akun diperbarui, tetapi profil gagal disimpan." }, 500);

    return json({ ok: true, password_updated: Boolean(password) });
  } catch {
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});