import { supabase } from "./supabase";
import { defaultModules, TenantSettings } from "./types";

export function fallbackSettings(tenantId: string): TenantSettings {
  return {
    tenant_id: tenantId,
    primary_color: "#0ea5e9",
    sidebar_color: "#0b1220",
    status: "active",
    modules: { ...defaultModules },
    custom_domain: null,
  };
}

export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  const { data, error } = await supabase.from("tenant_settings").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw error;
  if (!data) return fallbackSettings(tenantId);
  return {
    ...fallbackSettings(tenantId),
    ...data,
    modules: { ...defaultModules, ...(data.modules || {}) },
  } as TenantSettings;
}

export async function saveTenantSettings(settings: TenantSettings) {
  const { error } = await supabase.from("tenant_settings").upsert(settings, { onConflict: "tenant_id" });
  if (error) throw error;
}

export async function uploadTenantLogo(tenantId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["png","jpg","jpeg","webp","svg"].includes(ext) ? ext : "png";
  const path = `${tenantId}/logo-${Date.now()}.${safeExt}`;
  const { error } = await supabase.storage.from("tenant-assets").upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("tenant-assets").getPublicUrl(path);
  return data.publicUrl;
}
