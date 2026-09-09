import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/auth/session";
import { UserRole } from "@prisma/client";

import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session || !session.user || session.user.role !== UserRole.ADMIN) {
    redirect("/login");
  }

  const navLinks = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/temas", label: "Temas (Marketing)" },
    { href: "/admin/convites", label: "Convites" },
    { href: "/admin/eventos", label: "Eventos" },
    { href: "/admin/participantes", label: "Participantes" },
    { href: "/admin/ranking", label: "Ranking" },
    { href: "/admin/carimbos", label: "Carimbos" },
    { href: "/admin/auditoria", label: "Auditoria" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="border-b border-primary/20 bg-surface px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-sm font-bold text-premium">
              JRC
            </div>
            <span className="text-sm font-black tracking-wider text-foreground">
              PAINEL ADMIN
            </span>
          </Link>
          <span className="hidden sm:inline-block rounded-full bg-premium/10 px-2.5 py-0.5 text-[10px] font-bold text-premium border border-premium/30">
            Marketing / Coordenação
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/admin/export"
            download="passaporte-jrc-carimbos.csv"
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-secondary/40 bg-secondary/10 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-secondary/20 transition"
          >
            Exportar CSV
          </a>
          <span className="text-xs text-muted">{session.user.name}</span>
          <AdminLogoutButton />
        </div>
      </header>

      {/* Navegação Secundária */}
      <nav aria-label="Navegação administrativa" className="border-b border-muted/10 bg-surface/50 px-6 py-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-white/5 transition"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
