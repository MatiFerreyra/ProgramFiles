"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function PortalRouter() {
  const router = useRouter();
  const [message,setMessage] = useState("Verificando acceso...");
  useEffect(() => { (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.replace("/login");
    await supabase.rpc("claim_initial_platform_admin");
    const { data: admin } = await supabase.from("platform_admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
    if (admin) return router.replace("/");
    const { data: memberships, error } = await supabase.from("tenant_members").select("tenant_id,role,active").eq("user_id",session.user.id).eq("active",true).limit(1);
    if (error || !memberships?.length) { setMessage("Tu usuario no tiene una empresa asignada. Contactá al administrador de ProgramFiles."); return; }
    const { data: tenant } = await supabase.from("tenants").select("slug").eq("id",memberships[0].tenant_id).maybeSingle();
    if (!tenant?.slug) { setMessage("No se encontró la empresa asociada a tu usuario."); return; }
    router.replace(`/tenant/${tenant.slug}`);
  })(); }, [router]);
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400"/><p className="mt-5 text-sm text-slate-300">{message}</p></div></main>;
}
