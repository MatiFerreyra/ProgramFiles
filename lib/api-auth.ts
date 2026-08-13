import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";

export async function authenticateRequest(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { error: "No autenticado", status: 401 } as const;
  let admin;
  try { admin = getSupabaseAdmin(); }
  catch { return { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor", status: 500 } as const; }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: "Sesión inválida", status: 401 } as const;
  return { user: data.user, admin, token } as const;
}

export async function requirePlatformAdmin(request: Request) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth;
  const { data } = await auth.admin.from("platform_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (!data) return { error: "Permisos insuficientes", status: 403 } as const;
  return auth;
}

export async function requireTenantUserManager(request: Request, tenantId: string) {
  const auth = await authenticateRequest(request);
  if ("error" in auth) return auth;
  const { data: platform } = await auth.admin.from("platform_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (platform) return auth;
  const { data: member } = await auth.admin.from("tenant_members").select("role, permissions, active").eq("tenant_id", tenantId).eq("user_id", auth.user.id).maybeSingle();
  if (!member?.active) return { error: "Permisos insuficientes", status: 403 } as const;
  const can = ["owner","admin"].includes(member.role) || member.permissions?.manage_users === true;
  if (!can) return { error: "No podés administrar usuarios", status: 403 } as const;
  return auth;
}
