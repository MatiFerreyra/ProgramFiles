"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2, CreditCard, FileClock, FileText, Headphones, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, SlidersHorizontal, X } from "lucide-react";

export type AdminTab = "dashboard" | "companies" | "subscriptions" | "quotes" | "support" | "modules" | "audit" | "settings";

const items: { key: AdminTab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "companies", label: "Empresas", icon: Building2 },
  { key: "subscriptions", label: "Suscripciones y cobros", icon: CreditCard },
  { key: "quotes", label: "Presupuestos", icon: FileText },
  { key: "support", label: "Soporte", icon: Headphones },
  { key: "modules", label: "Plantillas y módulos", icon: SlidersHorizontal },
  { key: "audit", label: "Auditoría", icon: FileClock },
  { key: "settings", label: "Configuración", icon: Settings },
];

export default function AdminShell({ active, onChange, email, onLogout, children }: { active: AdminTab; onChange: (t: AdminTab) => void; email?: string; onLogout: () => void; children: React.ReactNode }) {
  const [open,setOpen]=useState(false);
  const nav=<><div className="border-b border-white/10 p-6"><Image src="/logo.png" alt="ProgramFiles" width={220} height={70} className="h-12 w-auto object-contain" priority /><div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-sky-300"><ShieldCheck size={12}/> CEO Console</div></div><nav className="flex-1 space-y-1 overflow-y-auto p-4">{items.map(({key,label,icon:Icon}) => <button key={key} onClick={()=>{onChange(key);setOpen(false)}} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${active===key?"bg-sky-500 text-white shadow-lg shadow-sky-500/20":"text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={18}/>{label}</button>)}</nav><div className="border-t border-white/10 p-4"><div className="rounded-2xl bg-white/5 p-3"><div className="truncate text-xs font-semibold text-white">{email || "Administrador"}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">CEO / Super Admin</div><button onClick={onLogout} className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold text-slate-400 hover:bg-red-500/10 hover:text-red-300"><LogOut size={15}/> Cerrar sesión</button></div></div></>;
  return <div className="min-h-screen bg-[#f4f7fb] lg:flex">
    <aside className="hidden w-72 shrink-0 flex-col bg-[#0b1220] text-white lg:flex">{nav}</aside>
    {open&&<><button onClick={()=>setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"/><aside className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#0b1220] text-white lg:hidden"><button onClick={()=>setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={20}/></button>{nav}</aside></>}
    <main className="min-w-0 flex-1"><div className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden"><button onClick={()=>setOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-700"><Menu size={20}/></button><div className="ml-3 text-sm font-black">ProgramFiles CEO</div></div>{children}</main>
  </div>;
}
