"use client";

import { useEffect,useState } from "react";
import { useParams,useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { TenantPortal } from "../../tenant/[subdomain]/page";

export default function CustomDomainPage(){
  const {hostname}=useParams<{hostname:string}>(); const router=useRouter(); const [slug,setSlug]=useState(""); const [error,setError]=useState("");
  useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();if(!session){router.replace(`/login?next=${encodeURIComponent(`/domain/${hostname}`)}`);return}const {data:settings,error}=await supabase.from("tenant_settings").select("tenant_id").ilike("custom_domain",decodeURIComponent(hostname)).maybeSingle();if(error||!settings){setError("Este dominio no está asociado a una empresa a la que tengas acceso.");return}const {data:tenant}=await supabase.from("tenants").select("slug").eq("id",settings.tenant_id).maybeSingle();if(!tenant?.slug){setError("No se pudo resolver la empresa para este dominio.");return}setSlug(tenant.slug)})()},[hostname,router]);
  if(error)return <main className="grid min-h-screen place-items-center bg-slate-100 p-6"><div className="max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black">Dominio no disponible</h1><p className="mt-2 text-sm text-slate-500">{error}</p></div></main>;
  if(!slug)return <main className="grid min-h-screen place-items-center bg-slate-100"><div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500"/></main>;
  return <TenantPortal slug={slug}/>;
}
