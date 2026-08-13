"use client";

import { useMemo,useState } from "react";
import { Archive, ExternalLink, ImagePlus, Save, ShieldBan, Trash2, X } from "lucide-react";
import Toggle from "./Toggle";
import { supabase } from "../lib/supabase";
import { ModuleKey, Subscription, Tenant, TenantSettings } from "../lib/types";
import { fallbackSettings, saveTenantSettings, uploadTenantLogo } from "../lib/settings";

const moduleMeta: Record<ModuleKey,[string,string]> = {
  dashboard:["Dashboard","Resumen general"], customers:["Clientes","Contactos y seguimiento"], inventory:["Inventario","Productos, precios y stock"],
  sales:["Ventas / POS","Operaciones de venta"], quotes:["Presupuestos","Cotizaciones"], cash:["Caja","Ingresos, egresos y cierres"],
  schedule:["Agenda / Turnos","Reservas y turnos"], suppliers:["Proveedores","Compras y proveedores"], employees:["Usuarios y roles","Accesos del equipo"], reports:["Reportes","Indicadores y estadísticas"],
};

type Props = {
  tenant: Tenant | null;
  initialSettings?: TenantSettings;
  initialSubscription?: Subscription | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export default function TenantEditor({tenant,initialSettings,initialSubscription,onClose,onSaved}:Props){
 const isNew=!tenant;
 const [name,setName]=useState(tenant?.name||""); const [slug,setSlug]=useState(tenant?.slug||"");
 const [settings,setSettings]=useState<TenantSettings>(initialSettings||fallbackSettings(tenant?.id||"pending"));
 const [plan,setPlan]=useState(initialSubscription?.plan||"starter"); const [monthlyPrice,setMonthlyPrice]=useState(String(initialSubscription?.monthly_price||initialSubscription?.mrr||29)); const [dueDate,setDueDate]=useState(initialSubscription?.due_date||""); const [autoSuspend,setAutoSuspend]=useState(Boolean(initialSubscription?.auto_suspend)); const [graceDays,setGraceDays]=useState(String(initialSubscription?.grace_days??5));
 const [logoFile,setLogoFile]=useState<File|null>(null); const [saving,setSaving]=useState(false); const [ownerPassword,setOwnerPassword]=useState(""); const [temporaryPassword,setTemporaryPassword]=useState("");

 const preview=useMemo(()=>slug?`/tenant/${slug}`:"",[slug]);
 function normalizeSlug(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,48)}
 function patch<K extends keyof TenantSettings>(key:K,value:TenantSettings[K]){setSettings(s=>({...s,[key]:value}))}

 async function authFetch(url:string,options:RequestInit){const {data:{session}}=await supabase.auth.getSession();if(!session)throw new Error("Sesión vencida");const res=await fetch(url,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`,...(options.headers||{})}});const data=await res.json();if(!res.ok)throw new Error(data.error||"Error");return data}

 async function save(){
   if(!name.trim())return alert("Ingresá el nombre de la empresa."); if(!slug.trim())return alert("Ingresá un slug válido.");
   setSaving(true);setTemporaryPassword("");
   try{
     let tenantId=tenant?.id||"";
     if(isNew){
       const {data,error}=await supabase.from("tenants").insert({name:name.trim(),slug:normalizeSlug(slug)}).select("*").single();
       if(error)throw error; tenantId=data.id;
     }else{
       const {error}=await supabase.from("tenants").update({name:name.trim(),slug:normalizeSlug(slug)}).eq("id",tenantId); if(error)throw error;
     }
     let logoUrl=settings.logo_url||null;
     if(logoFile)logoUrl=await uploadTenantLogo(tenantId,logoFile);
     const finalSettings:{[K in keyof TenantSettings]:TenantSettings[K]}={...settings,tenant_id:tenantId,logo_url:logoUrl,custom_domain:settings.custom_domain?.trim()||null};
     await saveTenantSettings(finalSettings);

     const subscriptionPayload={tenant_id:tenantId,plan,status:initialSubscription?.status||"active",mrr:Number(monthlyPrice||0),monthly_price:Number(monthlyPrice||0),currency:"ARS",due_date:dueDate||null,auto_suspend:autoSuspend,grace_days:Number(graceDays||5),updated_at:new Date().toISOString()};
     if(initialSubscription?.id){const {error}=await supabase.from("subscriptions").update(subscriptionPayload).eq("id",initialSubscription.id);if(error)throw error}else{const {error}=await supabase.from("subscriptions").insert(subscriptionPayload);if(error)throw error}

     let generatedPassword = "";
     let ownerCreationError = "";
     if(isNew&&settings.owner_email?.trim()){
       try {
         const created=await authFetch("/api/users",{method:"POST",body:JSON.stringify({tenant_id:tenantId,email:settings.owner_email.trim(),full_name:settings.owner_name||"Dueño",role:"owner",password:ownerPassword||undefined})});
         if(created.temporary_password){generatedPassword=created.temporary_password;setTemporaryPassword(created.temporary_password)}
       } catch (ownerError:any) {
         ownerCreationError = ownerError?.message || "No se pudo crear el acceso del dueño";
       }
     }
     await onSaved();
     if(ownerCreationError){alert(`La empresa quedó guardada, pero el usuario del dueño no se creó: ${ownerCreationError}`);onClose();return}
     if(!generatedPassword) onClose();
   }catch(e:any){alert(e?.message||"No se pudo guardar la empresa")}finally{setSaving(false)}
 }

 async function changeStatus(status:TenantSettings["status"]){if(!tenant)return;if(!confirm(`¿Cambiar el estado de ${tenant.name} a ${status}?`))return;try{await saveTenantSettings({...settings,status});setSettings(s=>({...s,status}));await onSaved()}catch(e:any){alert(e.message)}}
 async function removeTenant(){if(!tenant)return;const typed=prompt(`Para eliminar definitivamente escribí: ${tenant.name}`);if(typed!==tenant.name)return;const {error}=await supabase.from("tenants").delete().eq("id",tenant.id);if(error)return alert(error.message);await onSaved();onClose()}

 return <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm md:p-6"><div className="my-4 w-full max-w-6xl overflow-hidden rounded-3xl bg-[#f7f9fc] shadow-2xl">
  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-7"><div><div className="text-xs font-black uppercase tracking-[.2em] text-sky-600">ProgramFiles / Empresas</div><h2 className="mt-1 text-xl font-black">{isNew?"Nueva empresa":`Administrar ${tenant.name}`}</h2></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X/></button></div>
  <div className="grid gap-6 p-5 md:p-7 xl:grid-cols-3"><div className="space-y-6 xl:col-span-2">
   <Card title="Identidad de la empresa" subtitle="Nombre, URL, rubro y responsable."><div className="grid gap-4 md:grid-cols-2"><Field label="Nombre comercial" value={name} set={v=>{setName(v);if(isNew)setSlug(normalizeSlug(v))}}/><Field label="Slug / subdominio" value={slug} set={v=>setSlug(normalizeSlug(v))}/><Field label="Rubro" value={settings.business_type||""} set={v=>patch("business_type",v)}/><Field label="Dominio personalizado (opcional)" value={settings.custom_domain||""} set={v=>patch("custom_domain",v)}/><Field label="Nombre del dueño" value={settings.owner_name||""} set={v=>patch("owner_name",v)}/><Field label="Email del dueño" type="email" value={settings.owner_email||""} set={v=>patch("owner_email",v)}/><Field label="Teléfono / WhatsApp" value={settings.owner_phone||""} set={v=>patch("owner_phone",v)}/><Field label="Dirección" value={settings.address||""} set={v=>patch("address",v)}/><Field label="Ciudad" value={settings.city||""} set={v=>patch("city",v)}/><Field label="Provincia" value={settings.province||""} set={v=>patch("province",v)}/></div>{isNew&&settings.owner_email&&<div className="mt-4"><Field label="Contraseña inicial del dueño (opcional: se genera una segura)" type="password" value={ownerPassword} set={setOwnerPassword}/></div>}</Card>
   <Card title="Personalización visual" subtitle="El logo y los colores se guardan en Supabase."><div className="grid gap-5 md:grid-cols-3"><div className="md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase text-slate-500">Logo</label><label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4 hover:border-sky-400">{settings.logo_url?<img src={settings.logo_url} alt="Logo" className="h-14 w-14 rounded-xl object-cover"/>:<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><ImagePlus/></div>}<div><div className="text-sm font-bold">{logoFile?.name||"Elegir imagen"}</div><div className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP o SVG. Máximo 5 MB.</div></div><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e=>setLogoFile(e.target.files?.[0]||null)}/></label></div><div className="grid grid-cols-2 gap-3 md:grid-cols-1"><Color label="Color principal" value={settings.primary_color} set={v=>patch("primary_color",v)}/><Color label="Barra lateral" value={settings.sidebar_color} set={v=>patch("sidebar_color",v)}/></div></div></Card>
   <Card title="Módulos habilitados" subtitle="El cliente solo verá los módulos activados y permitidos por su rol."><div className="grid gap-3 sm:grid-cols-2">{(Object.keys(moduleMeta) as ModuleKey[]).map(k=><Toggle key={k} checked={settings.modules[k]} onChange={()=>patch("modules",{...settings.modules,[k]:!settings.modules[k]})} label={moduleMeta[k][0]} description={moduleMeta[k][1]}/>)}</div></Card>
  </div>
  <div className="space-y-6">
   <Card title="Plan y cobro" subtitle="Configuración de la suscripción mensual."><div className="space-y-4"><div><label className="mb-1 block text-xs font-bold text-slate-500">Plan</label><select value={plan} onChange={e=>setPlan(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option><option value="custom">Personalizado</option></select></div><Field label="Precio mensual (ARS)" type="number" value={monthlyPrice} set={setMonthlyPrice}/><Field label="Próximo vencimiento" type="date" value={dueDate||""} set={setDueDate}/><div className="grid grid-cols-2 gap-3"><Field label="Días de gracia" type="number" value={graceDays} set={setGraceDays}/><label className="flex items-end"><button type="button" onClick={()=>setAutoSuspend(!autoSuspend)} className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold ${autoSuspend?"border-amber-300 bg-amber-50 text-amber-700":"border-slate-200 bg-white text-slate-500"}`}>{autoSuspend?"Auto suspensión ON":"Auto suspensión OFF"}</button></label></div></div></Card>
   <Card title="Vista cliente" subtitle="Acceso real al panel de esta empresa."><div className="rounded-xl bg-slate-100 p-3 font-mono text-xs text-slate-600">{preview||"Se generará al guardar"}</div>{tenant&&<button onClick={()=>window.open(preview,"_blank")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><ExternalLink size={16}/> Abrir panel</button>}</Card>
   {!isNew&&<Card title="Estado y acciones" subtitle="Control de acceso del cliente."><div className="grid gap-2"><button onClick={()=>changeStatus(settings.status==="suspended"?"active":"suspended")} className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700"><ShieldBan size={16}/>{settings.status==="suspended"?"Reactivar empresa":"Suspender empresa"}</button><button onClick={()=>changeStatus(settings.status==="archived"?"active":"archived")} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"><Archive size={16}/>{settings.status==="archived"?"Restaurar empresa":"Archivar empresa"}</button><button onClick={removeTenant} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"><Trash2 size={16}/> Eliminar definitivamente</button></div></Card>}
  </div></div>
  {temporaryPassword&&<div className="mx-5 mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 md:mx-7"><div className="font-bold">Acceso del dueño creado. Contraseña temporal:</div><div className="mt-2 font-mono text-lg">{temporaryPassword}</div><div className="mt-1 text-xs">Copiala antes de cerrar esta ventana.</div></div>}
  <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5 md:px-7"><button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600">Cancelar</button><button disabled={saving} onClick={save} className="flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 disabled:opacity-50"><Save size={17}/>{saving?"Guardando...":"Guardar cambios"}</button></div>
 </div></div>
}

function Card({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-900">{title}</h3><p className="mt-1 mb-5 text-xs leading-5 text-slate-400">{subtitle}</p>{children}</section>}
function Field({label,value,set,type="text"}:{label:string;value:string;set:(v:string)=>void;type?:string}){return <div><label className="mb-1 block text-xs font-bold text-slate-500">{label}</label><input type={type} value={value} min={type==="number"?0:undefined} onChange={e=>set(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"/></div>}
function Color({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <div><label className="mb-1 block text-xs font-bold text-slate-500">{label}</label><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><input type="color" value={value} onChange={e=>set(e.target.value)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"/><span className="text-xs font-mono text-slate-500">{value}</span></div></div>}
