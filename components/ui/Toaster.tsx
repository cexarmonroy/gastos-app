"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster } from "sonner";

/** Arriba al centro en móvil, abajo a la derecha en escritorio. */
export function Toaster() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    setIsDesktop(query.matches);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return (
    <SonnerToaster
      position={isDesktop ? "bottom-right" : "top-center"}
      toastOptions={{
        classNames: {
          toast: "!bg-surface !border !border-border !text-foreground !shadow-xl",
          title: "!text-foreground !font-medium",
          description: "!text-muted",
          actionButton: "!bg-primary !text-white",
          cancelButton: "!bg-surface-elevated !text-foreground",
        },
      }}
    />
  );
}
