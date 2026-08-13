import "./globals.css";

export const metadata = {
  title: "ProgramFiles | Gestión empresarial",
  description: "Plataforma SaaS multiempresa de gestión para comercios y servicios.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body className="bg-slate-100 text-slate-900 font-sans antialiased">{children}</body></html>;
}
