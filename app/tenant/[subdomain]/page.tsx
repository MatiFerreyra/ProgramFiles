"use client";

import { useEffect,useMemo,useState } from "react";
import { useParams,useRouter } from "next/navigation";
import { Activity, BarChart3, CalendarDays, ChevronRight, ClipboardList, DollarSign, LayoutDashboard, LogOut, Menu, Package, ReceiptText, Store, Truck, UserRoundCog, Users, Wallet, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { getTenantSettings } from "../../../lib/settings";
import { ModuleKey, TenantMember, TenantRole, TenantSettings } from "../../../lib/types";
import { hasPermission, moduleManagePermission, moduleViewPermission, roleLabels } from "../../../lib/permissions";
import InventoryModule from "./components/InventoryModule";
import GenericCrud from "./components/GenericCrud";
import TenantUsersModule from "./components/TenantUsersModule";

const nav: {key:ModuleKey;label:string;icon:any}[]=[
 {key:"dashboard",label:"Dashboard",icon:LayoutDashboard},{key:"customers",label:"Clientes",icon:Users},{key:"inventory",label:"Inventario",icon:Package},
 {key:"sales",label:"Ventas",icon:ReceiptText},{key:"quotes",label:"Presupuestos",icon:ClipboardList},{key:"cash",label:"Caja",icon:Wallet},
 {key:"schedule",label:"Agenda / Turnos",icon:CalendarDays},{key:"suppliers",label:"Proveedores",icon:Truck},{key:"employees",label:"Usuarios y roles",icon:UserRoundCog},{key:"reports",label:"Reportes",icon:BarChart3}
];

export default function TenantDashboard(){
 const {subdomain}=useParams<{subdomain:string}>();
 return <TenantPortal slug={subdomain}/>;
}

export function TenantPortal({slug:subdomain}:{slug:string}){
 const router=useRouter();
 const [tenant,setTenant]=useState<any>(null); const [settings,setSettings]=useState<TenantSettings|null>(null); const [member,setMember]=useState<TenantMember|null>(null); const [platformAdmin,setPlatformAdmin]=useState(false);
 const [active,setActive]=useState<ModuleKey>("dashboard"); const [menu,setMenu]=useState(false); const [loading,setLoading]=useState(true); const [sessionEmail,setSessionEmail]=useState(""); const [error,setError]=useState("");

 useEffect(()=>{(async()=>{
   setLoading(true);setError("");
   const {data:{session}}=await supabase.auth.getSession();
   if(!session){router.replace(`/login?next=${encodeURIComponent(`/tenant/${subdomain}`)}`);return}
   setSessionEmail(session.user.email||"");
   const {data:admin}=await supabase.from("platform_admins").select("user_id").eq("user_id",session.user.id).maybeSingle();
   const isAdmin=Boolean(admin);setPlatformAdmin(isAdmin);
   const {data,error:tenantError}=await supabase.from("tenants").select("*").eq("slug",subdomain).maybeSingle();
   if(tenantError||!data){setError("No tenés acceso a esta empresa o la empresa no existe.");setLoading(false);return}
   setTenant(data);
   try{setSettings(await getTenantSettings(data.id))}catch(e:any){setError(e.message||"No se pudo cargar la configuración de la empresa")}
   if(!isAdmin){const {data:m}=await supabase.from("tenant_members").select("tenant_id,user_id,role,permissions,active,created_at").eq("tenant_id",data.id).eq("user_id",session.user.id).maybeSingle();setMember(m as TenantMember|null)}
   setLoading(false);
 })()},[subdomain,router]);

 const role=(member?.role||null) as TenantRole|null; const overrides=useMemo(()=>member?.permissions||{},[member?.permissions]);
 const enabled=useMemo(()=>nav.filter(x=>{
   if(!settings?.modules[x.key])return false;
   if(x.key==="dashboard")return true;
   const p=moduleViewPermission[x.key]; return !p||hasPermission(role,overrides,p,platformAdmin);
 }),[settings,role,overrides,platformAdmin]);
 useEffect(()=>{if(!enabled.some(x=>x.key===active))setActive("dashboard")},[enabled,active]);

 async function logout(){await supabase.auth.signOut();router.replace("/login")}
 if(loading)return <div className="grid min-h-screen place-items-center bg-slate-100"><div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500"/></div>;
 if(error||!tenant||!settings)return <div className="grid min-h-screen place-items-center bg-slate-100 p-5"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm"><Store className="mx-auto text-slate-400"/><h1 className="mt-4 text-xl font-black">Acceso no disponible</h1><p className="mt-2 text-sm leading-6 text-slate-500">{error||"Empresa no encontrada"}</p><button onClick={()=>router.push("/portal")} className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Volver al portal</button></div></div>;
 if(settings.status!=="active")return <div className="grid min-h-screen place-items-center bg-slate-100 p-5"><div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Store/></div><h1 className="mt-5 text-2xl font-black">Servicio no disponible</h1><p className="mt-2 text-sm leading-6 text-slate-500">La cuenta de {tenant.name} se encuentra {settings.status==="suspended"?"suspendida":"archivada"}. Contactá a ProgramFiles.</p><button onClick={logout} className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Cerrar sesión</button></div></div>;

 const accent=settings.primary_color||"#0ea5e9";const side=settings.sidebar_color||"#0b1220"; const displayRole=platformAdmin?"ProgramFiles / Super Admin":role?roleLabels[role]:"Usuario";
 return <div className="min-h-screen bg-[#f4f7fb] lg:flex">
  <aside className={`${menu?"fixed inset-y-0 left-0 z-40 flex":"hidden"} w-72 shrink-0 flex-col text-white lg:sticky lg:top-0 lg:flex lg:h-screen`} style={{background:side}}>
   <div className="flex items-center justify-between border-b border-white/10 p-5"><div className="flex min-w-0 items-center gap-3">{settings.logo_url?<img src={settings.logo_url} className="h-11 w-11 shrink-0 rounded-xl object-cover" alt={`Logo ${tenant.name}`}/>:<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white" style={{background:accent}}>{tenant.name.slice(0,2).toUpperCase()}</div>}<div className="min-w-0"><div className="max-w-40 truncate font-black">{tenant.name}</div><div className="truncate text-[10px] uppercase tracking-wider text-slate-400">{displayRole}</div></div></div><button onClick={()=>setMenu(false)} className="lg:hidden"><X/></button></div>
   <nav className="flex-1 space-y-1 overflow-y-auto p-4">{enabled.map(({key,label,icon:Icon})=><button key={key} onClick={()=>{setActive(key);setMenu(false)}} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${active===key?"text-white":"text-slate-400 hover:bg-white/5 hover:text-white"}`} style={active===key?{background:accent}:undefined}><Icon size={18}/>{label}</button>)}</nav>
   <div className="border-t border-white/10 p-4"><div className="rounded-2xl bg-white/5 p-4"><div className="truncate text-xs font-bold">{settings.owner_name||sessionEmail||"Administrador"}</div><div className="mt-1 truncate text-[10px] text-slate-500">{sessionEmail}</div><button onClick={logout} className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-red-300"><LogOut size={14}/> Cerrar sesión</button></div></div>
  </aside>
  {menu&&<button onClick={()=>setMenu(false)} className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"/>}
  <main className="min-w-0 flex-1"><header className="sticky top-0 z-20 flex h-18 items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur md:px-8"><div className="flex items-center gap-3"><button onClick={()=>setMenu(true)} className="rounded-xl border border-slate-200 p-2 lg:hidden"><Menu size={19}/></button><div><div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">{tenant.name}</div><div className="font-black text-slate-900">{nav.find(x=>x.key===active)?.label}</div></div></div><div className="flex items-center gap-3"><span className="hidden text-xs font-semibold text-slate-500 sm:block">{displayRole}</span><div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">{(settings.owner_name||sessionEmail||tenant.name).slice(0,1).toUpperCase()}</div></div></header><div className="p-5 md:p-8"><div className="mx-auto max-w-7xl">{renderModule(active,tenant.id,accent,tenant.name,settings,role,overrides,platformAdmin)}</div></div></main>
 </div>
}

function renderModule(active:ModuleKey,tenantId:string,accent:string,name:string,settings:TenantSettings,role:TenantRole|null,overrides:any,platformAdmin:boolean){
 const manage=moduleManagePermission[active]; const canWrite=!manage||hasPermission(role,overrides,manage,platformAdmin);
 if(active==="inventory")return <InventoryModule tenantId={tenantId} accent={accent} canWrite={canWrite} canDelete={canWrite}/>;
 if(active==="customers")return <GenericCrud tenantId={tenantId} table="customers" title="Clientes" description="Contactos, teléfonos y seguimiento comercial." accent={accent} canWrite={canWrite} canDelete={canWrite} fields={[{key:"name",label:"Nombre"},{key:"email",label:"Email",type:"email"},{key:"phone",label:"Teléfono"}]}/>;
 if(active==="quotes")return <GenericCrud tenantId={tenantId} table="quotes" title="Presupuestos" description="Cotizaciones y propuestas para tus clientes." accent={accent} canWrite={canWrite} canDelete={canWrite} fields={[{key:"customer_name",label:"Cliente"},{key:"description",label:"Descripción"},{key:"total",label:"Total",type:"number"}]}/>;
 if(active==="cash")return <GenericCrud tenantId={tenantId} table="cash_movements" title="Caja" description="Ingresos y egresos de la empresa." accent={accent} canWrite={canWrite} canDelete={canWrite} fields={[{key:"concept",label:"Concepto"},{key:"type",label:"Tipo"},{key:"amount",label:"Importe",type:"number"}]}/>;
 if(active==="schedule")return <GenericCrud tenantId={tenantId} table="appointments" title="Agenda / Turnos" description="Organizá reservas y turnos." accent={accent} canWrite={canWrite} canDelete={canWrite} fields={[{key:"customer_name",label:"Cliente"},{key:"scheduled_at",label:"Fecha y hora",type:"datetime-local"},{key:"notes",label:"Detalle"}]}/>;
 if(active==="suppliers")return <GenericCrud tenantId={tenantId} table="suppliers" title="Proveedores" description="Contactos y proveedores habituales." accent={accent} canWrite={canWrite} canDelete={canWrite} fields={[{key:"name",label:"Nombre"},{key:"email",label:"Email",type:"email"},{key:"phone",label:"Teléfono"}]}/>;
 if(active==="employees")return <TenantUsersModule tenantId={tenantId} accent={accent}/>;
 if(active==="sales")return <GenericCrud tenantId={tenantId} table="sales" title="Ventas" description="Registrá operaciones de venta." accent={accent} canWrite={canWrite} canDelete={canWrite} fields={[{key:"customer_name",label:"Cliente"},{key:"description",label:"Detalle"},{key:"total",label:"Total",type:"number"}]}/>;
 if(active==="reports")return <Reports tenantId={tenantId} accent={accent}/>;
 return <ClientHome tenantId={tenantId} name={name} accent={accent} settings={settings}/>;
}

function ClientHome({tenantId,name,accent,settings}:{tenantId:string;name:string;accent:string;settings:TenantSettings}){const [stats,setStats]=useState({sales:0,customers:0,products:0,operations:0});useEffect(()=>{(async()=>{const [sales,customers,products]=await Promise.all([supabase.from("sales").select("total",{count:"exact"}).eq("tenant_id",tenantId),supabase.from("customers").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId),supabase.from("products").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId)]);setStats({sales:(sales.data||[]).reduce((a:any,x:any)=>a+Number(x.total||0),0),operations:sales.count||0,customers:customers.count||0,products:products.count||0})})()},[tenantId]);const count=Object.entries(settings.modules).filter(([,v])=>v).length;return <div><div className="rounded-3xl p-7 text-white shadow-xl" style={{background:`linear-gradient(120deg, ${settings.sidebar_color}, ${accent})`}}><div className="text-xs font-black uppercase tracking-[.2em] text-white/70">Dashboard</div><h1 className="mt-2 text-3xl font-black">Bienvenido a {name}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/75">Tu operación diaria, clientes, ventas y gestión desde un solo lugar.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Ventas acumuladas",`$ ${stats.sales.toLocaleString("es-AR")}`,DollarSign],["Clientes",String(stats.customers),Users],["Operaciones",String(stats.operations),Activity],["Productos",String(stats.products),Package]].map(([a,b,I]:any)=><div key={a} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="text-sm text-slate-500">{a}</div><I size={18} style={{color:accent}}/></div><div className="mt-4 text-2xl font-black">{b}</div><div className="mt-1 text-xs text-slate-400">Datos de tu empresa</div></div>)}</div><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-black">Primeros pasos</h2><p className="mt-1 text-xs text-slate-400">{count} módulos habilitados</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{["Cargá tus clientes","Agregá productos o servicios","Registrá tu primera venta"].map((x,i)=><div key={x} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white" style={{background:accent}}>{i+1}</span><span className="text-sm font-semibold">{x}</span><ChevronRight className="ml-auto text-slate-300" size={16}/></div>)}</div></section></div>}
function Reports({tenantId,accent}:{tenantId:string;accent:string}){const [stats,setStats]=useState({sales:0,customers:0,products:0});useEffect(()=>{(async()=>{const [s,c,p]=await Promise.all([supabase.from("sales").select("total").eq("tenant_id",tenantId),supabase.from("customers").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId),supabase.from("products").select("id",{count:"exact",head:true}).eq("tenant_id",tenantId)]);setStats({sales:(s.data||[]).reduce((a:any,x:any)=>a+Number(x.total||0),0),customers:c.count||0,products:p.count||0})})()},[tenantId]);return <div><h2 className="text-2xl font-black">Reportes</h2><p className="mt-1 text-sm text-slate-500">Indicadores generales del negocio.</p><div className="mt-6 grid gap-4 md:grid-cols-3">{[["Ventas",`$ ${stats.sales.toLocaleString("es-AR")}`],["Clientes",stats.customers],["Inventario",stats.products]].map(([x,v])=><div key={x} className="rounded-2xl border bg-white p-6 shadow-sm"><div className="text-sm text-slate-500">{x}</div><div className="mt-4 text-3xl font-black">{v}</div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 w-2/3 rounded-full" style={{background:accent}}/></div></div>)}</div></div>}
