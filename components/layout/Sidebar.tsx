"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Settings, PieChart, X, Menu } from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/records", icon: Receipt, label: "Registros" },
  { href: "/reports", icon: PieChart, label: "Reportes" },
  { href: "/settings", icon: Settings, label: "Configuración" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <div className="p-4 md:p-6 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight" onClick={() => setIsMobileOpen(false)}>
          Tesorería<span className="text-gradient">CGPA</span>
        </Link>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-2 text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-2 md:px-4 space-y-2 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={clsx(
                "flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 rounded-lg transition-all duration-300 text-sm md:text-base",
                isActive 
                  ? "bg-primary/20 text-white border border-primary/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={clsx("w-4 h-4 md:w-5 md:h-5 flex-shrink-0", isActive ? "text-primary" : "text-white/40")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 md:p-4 m-2 md:m-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-white/5 hidden md:block">
        <p className="text-xs text-white/60 mb-2">Espacio de uso</p>
        <div className="w-full bg-black/40 rounded-full h-1.5 mb-1">
          <div className="bg-gradient-to-r from-primary to-accent h-1.5 rounded-full w-1/4" />
        </div>
        <p className="text-[10px] text-white/40 text-right">25% utilizado</p>
      </div>
    </>
  );

  return (
    <>
      {/* Botón de menú móvil */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-background/80 backdrop-blur-xl border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay móvil */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 h-screen border-r border-white/10 bg-background/50 backdrop-blur-xl flex-col pointer-events-auto">
        <SidebarContent />
      </aside>

      {/* Sidebar Móvil */}
      <aside
        className={clsx(
          "md:hidden fixed left-0 top-0 h-screen w-64 border-r border-white/10 bg-background/95 backdrop-blur-xl flex flex-col pointer-events-auto z-50 transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
