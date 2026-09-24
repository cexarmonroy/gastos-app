"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Pregunta, ej. "¿Anular este movimiento?" */
  title: string;
  /** Consecuencia explicada en lenguaje humano. */
  description: string;
  /** Verbo exacto de la acción, ej. "Anular movimiento". */
  confirmLabel: string;
  variant?: "destructive" | "primary";
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  variant = "destructive",
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      maxWidthClassName="max-w-sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} autoFocus disabled={isConfirming}>
            Cancelar
          </Button>
          <Button variant={variant} size="md" onClick={handleConfirm} loading={isConfirming}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{description}</p>
    </Dialog>
  );
}
