"use client";

import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { User, LogOut } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DIRECTIVA: "Directiva",
  USER: "Apoderado",
};

export function Navbar() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return (
    <header className="h-16 md:h-20 border-b border-border bg-surface flex items-center justify-between pl-14 md:pl-8 pr-4 md:pr-8 sticky top-0 z-30">
      <Image
        src="/logo-header.png"
        alt="Colegio Emprender Puente Alto"
        width={2569}
        height={883}
        priority
        className="h-8 md:h-10 w-auto object-contain"
      />

      <div className="flex items-center gap-2 md:gap-3">
        <div className="text-right hidden lg:block">
          <p className="text-xs md:text-sm font-medium text-foreground truncate max-w-[160px]">
            {session?.user?.email || "Cargando..."}
          </p>
          <p className="text-xs text-primary">{role ? (ROLE_LABELS[role] ?? role) : "Usuario"}</p>
        </div>
        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 flex-shrink-0">
          <User className="w-4 h-4 md:w-5 md:h-5 text-primary" />
        </div>
        <IconButton
          aria-label="Cerrar sesión"
          variant="danger"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="w-4 h-4 md:w-5 md:h-5" />
        </IconButton>
      </div>
    </header>
  );
}
