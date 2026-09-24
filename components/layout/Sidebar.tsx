"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, PieChart, Users, X, Menu, ArrowRightLeft, Scale, Shield, PartyPopper, HardHat, Globe, UserCog, LogOut } from "lucide-react";
import clsx from "clsx";
import Image from "next/image";
import { IconButton } from "@/components/ui/IconButton";

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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DIRECTIVA: "Directiva",
  USER: "Apoderado",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Sidebar({ publicPortalEnabled = false }: { publicPortalEnabled?: boolean }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const userRole = session?.user?.role || "USER";
  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));
  const displayName = session?.user?.name || session?.user?.email || "Cargando...";

  const SidebarContent = () => (
    <>
      <div className="h-16 px-4 md:px-6 flex items-center justify-between shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0" onClick={() => setIsMobileOpen(false)}>
          <div className="relative w-8 h-8 shrink-0">
            <Image src="/logo-cgpa.png" alt="Logo CGPA" fill className="object-contain" />
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="text-sm font-semibold text-primary truncate">Tesorería CGPA</span>
            <span className="text-[11px] font-semibold text-info uppercase tracking-wider truncate">
              Centro de Padres
            </span>
          </div>
        </Link>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-2 text-muted hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 md:px-6">
        <div className="h-px bg-border" />
      </div>

      <nav className="flex-1 px-2 md:px-4 py-3 space-y-1 overflow-y-auto custom-scrollbar">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 md:px-4 py-2.5 rounded-lg transition-colors text-sm md:text-base",
                isActive
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-surface-elevated"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {publicPortalEnabled && (
        <div className="px-4 md:px-6 pb-3">
          <Link
            href="/portal"
            target="_blank"
            className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
          >
            <Globe className="w-4 h-4 text-primary" />
            Portal público
          </Link>
        </div>
      )}

      <div className="p-3 mx-3 mb-3 rounded-xl bg-surface-elevated shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-semibold">{getInitials(displayName)}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{displayName}</span>
              <span className="text-xs text-muted truncate">{ROLE_LABELS[userRole] ?? userRole}</span>
            </div>
          </div>
          <IconButton
            aria-label="Cerrar sesión"
            variant="danger"
            className="w-8 h-8 shrink-0"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut className="w-[18px] h-[18px]" />
          </IconButton>
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
      <aside className="hidden md:flex w-72 h-screen border-r border-border bg-surface flex-col pointer-events-auto">
        <SidebarContent />
      </aside>

      {/* Sidebar Móvil */}
      <aside
        className={clsx(
          "md:hidden fixed left-0 top-0 h-screen w-72 border-r border-border bg-surface flex flex-col pointer-events-auto z-50 transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
