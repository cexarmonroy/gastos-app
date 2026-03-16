"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, Bell, Search, User } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="h-16 md:h-20 border-b border-white/10 bg-background/50 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
      
      <div className="flex items-center gap-2 md:gap-4 flex-1">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 md:py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6">
        <button className="relative p-1.5 md:p-2 text-white/60 hover:text-white transition-colors">
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          <span className="absolute top-0.5 right-0.5 md:top-1 md:right-1 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-danger animate-pulse" />
        </button>
        
        <div className="h-6 md:h-8 w-[1px] bg-white/10 hidden sm:block" />

        <div className="flex items-center gap-2 md:gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-xs md:text-sm font-medium text-white truncate max-w-[120px]">{session?.user?.email || "Cargando..."}</p>
            <p className="text-[10px] md:text-xs text-primary capitalize">{session?.user?.role?.toLowerCase() || "Usuario"}</p>
          </div>
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 flex-shrink-0">
            <User className="w-4 h-4 md:w-5 md:h-5 text-primary" />
          </div>
        </div>

        <button 
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="p-1.5 md:p-2 text-danger/80 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

    </header>
  );
}
