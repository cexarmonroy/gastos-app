"use client";

import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** max-w-* de Tailwind para el modal en escritorio. Por defecto max-w-lg. */
  maxWidthClassName?: string;
}

/**
 * Diálogo accesible (foco atrapado, Esc, foco devuelto al disparador via Radix).
 * En móvil (<640px) se muestra como hoja inferior a pantalla casi completa.
 */
export function Dialog({ open, onClose, title, children, footer, maxWidthClassName = "max-w-lg" }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[100] bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <RadixDialog.Content
          className={cn(
            "fixed z-[101] bg-surface border border-border shadow-xl overflow-y-auto custom-scrollbar focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-xl max-h-[92dvh] w-full",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
            "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:max-h-[90dvh] sm:w-full",
            "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0",
            maxWidthClassName
          )}
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <RadixDialog.Title className="text-xl font-bold">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="p-2 text-muted hover:text-foreground bg-surface-elevated hover:bg-border/40 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </RadixDialog.Close>
          </div>

          <div className="p-6">{children}</div>

          {footer && (
            <div className="sticky bottom-0 bg-surface p-6 pt-4 border-t border-border flex justify-end gap-3">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
