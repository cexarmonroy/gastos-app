"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, PieChart, Users, X, Menu, ArrowRightLeft, Scale, Shield, PartyPopper, HardHat, Globe, UserCog } from "lucide-react";
import clsx from "clsx";
import Image from "next/image";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["ADMIN", "USER", "DIRECTIVA"] },
  { href: "/inscripciones", icon: Users, label: "Inscripciones 2026", roles: ["ADMIN", "DIRECTIVA"] },
  { href: "/records", icon: Receipt, label: "Registros", roles: ["ADMIN", "USER", "DIRECTIVA"] },
  { href: "/events", icon: PartyPopper, label: "Actividades", roles: ["ADMIN", "USER", "DIRECTIVA"] },
  { href: "/projects", icon: HardHat, label: "Proyectos", roles: ["ADMIN", "USER", "DIRECTIVA"] },
  { href: "/transfers", icon: ArrowRightLeft, label: "Transferencias", roles: ["ADMIN", "DIRECTIVA"] },
  { href: "/reports", icon: PieChart, label: "Reportes", roles: ["ADMIN", "DIRECTIVA"] },
  { href: "/reconciliation", icon: Scale, label: "Conciliación", roles: ["ADMIN", "DIRECTIVA"] },
  { href: "/audit", icon: Shield, label: "Auditoría", roles: ["ADMIN", "DIRECTIVA"] },
  { href: "/users", icon: UserCog, label: "Usuarios", roles: ["ADMIN"] },
];

export function Sidebar({ publicPortalEnabled = false }: { publicPortalEnabled?: boolean }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const userRole = session?.user?.role || "USER";
  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

  const SidebarContent = () => (
    <>
      <div className="p-4 md:p-6 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={() => setIsMobileOpen(false)}>
          <div className="relative w-10 h-10 md:w-12 md:h-12 overflow-hidden rounded-xl border border-border bg-surface-elevated p-1 transition-all duration-500 group-hover:scale-110 group-hover:border-primary/50 group-hover:shadow-md">
            <Image
              src="/logo-cgpa.png"
              alt="Logo CGPA"
              fill
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-foreground leading-tight">Tesorería</span>
            <span className="text-sm font-semibold text-primary -mt-1">CGPA</span>
          </div>
        </Link>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-2 text-muted hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-2 md:px-4 space-y-2 mt-4">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-all duration-300 text-sm md:text-base",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted hover:text-foreground hover:bg-surface-elevated"
              )}
            >
              <item.icon className={clsx("w-4 h-4 md:w-5 md:h-5 flex-shrink-0", isActive ? "text-primary" : "text-muted")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 md:p-4 m-2 md:m-4 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 border border-border hidden md:block space-y-3">
        {publicPortalEnabled && (
          <Link
            href="/portal"
            target="_blank"
            className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
          >
            <Globe className="w-4 h-4 text-primary" />
            Portal público
          </Link>
        )}
        <div>
          <p className="text-xs text-muted mb-2">Espacio de uso</p>
          <div className="w-full bg-border rounded-full h-1.5 mb-1">
            <div className="bg-gradient-to-r from-primary to-accent h-1.5 rounded-full w-1/4" />
          </div>
          <p className="text-[10px] text-muted text-right">25% utilizado</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Botón de menú móvil */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-surface border border-border rounded-lg text-foreground hover:bg-surface-elevated transition-colors shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay móvil */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 h-screen border-r border-border bg-surface flex-col pointer-events-auto">
        <SidebarContent />
      </aside>

      {/* Sidebar Móvil */}
      <aside
        className={clsx(
          "md:hidden fixed left-0 top-0 h-screen w-64 border-r border-border bg-surface flex flex-col pointer-events-auto z-50 transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
