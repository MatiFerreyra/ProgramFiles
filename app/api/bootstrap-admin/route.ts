import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bootstrapEmail = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";

  if (!url || !anonKey || !serviceRoleKey || !bootstrapEmail) {
    return NextResponse.json({ error: "El acceso inicial todavía no fue configurado." }, { status: 503 });
  }
  if (!token) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userResult, error: userError } = await authClient.auth.getUser(token);
  const user = userResult.user;
  if (userError || !user?.email) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  if (user.email.trim().toLowerCase() !== bootstrapEmail) {
    return NextResponse.json({ error: "Esta cuenta no está autorizada como administradora de ProgramFiles." }, { status: 403 });
  }

  const serviceClient = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await serviceClient.from("platform_admins").upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "No se pudo habilitar el acceso administrador." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
