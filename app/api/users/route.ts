import { NextResponse } from "next/server";
import { requireTenantUserManager } from "../../../lib/api-auth";
import { TenantRole } from "../../../lib/types";

const roles: TenantRole[] = ["owner","admin","manager","sales","cashier","inventory","reception","viewer"];

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenant_id") || "";
  if (!tenantId) return NextResponse.json({ error: "tenant_id requerido" }, { status: 400 });
  const auth = await requireTenantUserManager(request, tenantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: members, error } = await auth.admin.from("tenant_members").select("tenant_id,user_id,role,permissions,active,created_at").eq("tenant_id", tenantId).order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = (members || []).map(m => m.user_id);
  const { data: profiles } = ids.length ? await auth.admin.from("user_profiles").select("user_id,email,full_name,phone").in("user_id", ids) : { data: [] as any[] };
  const map = new Map((profiles || []).map(p => [p.user_id, p]));
  return NextResponse.json({ members: (members || []).map(m => ({ ...m, ...(map.get(m.user_id) || {}) })) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tenantId = String(body.tenant_id || "");
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  const role = roles.includes(body.role) ? body.role as TenantRole : "viewer";
  const permissions = typeof body.permissions === "object" && body.permissions ? body.permissions : {};
  if (!tenantId || !email || !email.includes("@")) return NextResponse.json({ error: "Empresa y email válidos son obligatorios" }, { status: 400 });
  const auth = await requireTenantUserManager(request, tenantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const generated = !body.password;
  const password = String(body.password || `Pf!${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}9a`);
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });

  let userId = "";
  const { data: existing } = await auth.admin.from("user_profiles").select("user_id").eq("email", email).maybeSingle();
  if (existing?.user_id) {
    userId = existing.user_id;
  } else {
    const { data, error } = await auth.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
    if (error || !data.user) return NextResponse.json({ error: error?.message || "No se pudo crear el usuario" }, { status: 400 });
    userId = data.user.id;
  }

  await auth.admin.from("user_profiles").upsert({ user_id: userId, email, full_name: fullName || null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  const { error: memberError } = await auth.admin.from("tenant_members").upsert({ tenant_id: tenantId, user_id: userId, role, permissions, active: true, updated_at: new Date().toISOString() }, { onConflict: "tenant_id,user_id" });
  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 400 });
  await auth.admin.from("audit_logs").insert({ tenant_id: tenantId, actor_user_id: auth.user.id, action: "create_user", table_name: "tenant_members", record_id: userId, new_data: { email, full_name: fullName, role } });

  return NextResponse.json({ ok: true, user_id: userId, temporary_password: generated ? password : undefined });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tenantId = String(body.tenant_id || "");
  const userId = String(body.user_id || "");
  const role = roles.includes(body.role) ? body.role as TenantRole : undefined;
  if (!tenantId || !userId) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const auth = await requireTenantUserManager(request, tenantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (role) patch.role = role;
  if (typeof body.active === "boolean") patch.active = body.active;
  if (body.permissions && typeof body.permissions === "object") patch.permissions = body.permissions;
  const { error } = await auth.admin.from("tenant_members").update(patch).eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auth.admin.from("audit_logs").insert({ tenant_id: tenantId, actor_user_id: auth.user.id, action: "update_user", table_name: "tenant_members", record_id: userId, new_data: patch });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  const tenantId = String(body.tenant_id || "");
  const userId = String(body.user_id || "");
  if (!tenantId || !userId) return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  const auth = await requireTenantUserManager(request, tenantId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (userId === auth.user.id) return NextResponse.json({ error: "No podés quitar tu propio acceso desde esta pantalla" }, { status: 400 });
  const { error } = await auth.admin.from("tenant_members").delete().eq("tenant_id", tenantId).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auth.admin.from("audit_logs").insert({ tenant_id: tenantId, actor_user_id: auth.user.id, action: "remove_user", table_name: "tenant_members", record_id: userId });
  return NextResponse.json({ ok: true });
}
