export default function StatCard({ label, value, note, icon }: { label:string; value:string; note:string; icon:React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between"><div><div className="text-sm font-medium text-slate-500">{label}</div><div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</div><div className="mt-2 text-xs font-semibold text-emerald-600">{note}</div></div><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">{icon}</div></div>
  </div>;
}
