"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calendar as CalendarIcon, AlignLeft } from "lucide-react";
import { createTransfer } from "@/app/actions/transfers";
import { todayDateInputValue } from "@/lib/date-only";
import type { FundTab } from "@/lib/finance/types";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function TransferModal({ isOpen, onClose, onSaved }: TransferModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fromFund: "caja_chica" as FundTab,
    toFund: "fondo_ahorro" as FundTab,
    amount: "",
    date: todayDateInputValue(),
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const result = await createTransfer({
      fromFund: formData.fromFund,
      toFund: formData.toFund,
      amount: Number(formData.amount),
      date: formData.date,
      description: formData.description,
    });

    if (result.success) {
      toast.success("Transferencia registrada");
      onSaved?.();
      onClose();
      setFormData({
        fromFund: "caja_chica",
        toFund: "fondo_ahorro",
        amount: "",
        date: todayDateInputValue(),
        description: "",
      });
    } else {
      toast.error(result.error ?? "No pudimos guardar la transferencia.");
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title="Nueva transferencia"
      footer={
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="transfer-form" size="md" loading={isSubmitting} loadingText="Guardando...">
            Transferir
          </Button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Desde">
            {(inputProps) => (
              <select
                {...inputProps}
                name="fromFund"
                value={formData.fromFund}
                onChange={(e) => setFormData((p) => ({ ...p, fromFund: e.target.value as FundTab }))}
                className="select-premium py-[11px]"
              >
                <option value="caja_chica">Caja Chica</option>
                <option value="fondo_ahorro">Fondo de Ahorro</option>
              </select>
            )}
          </Field>
          <Field label="Hacia">
            {(inputProps) => (
              <select
                {...inputProps}
                name="toFund"
                value={formData.toFund}
                onChange={(e) => setFormData((p) => ({ ...p, toFund: e.target.value as FundTab }))}
                className="select-premium py-[11px]"
              >
                <option value="caja_chica">Caja Chica</option>
                <option value="fondo_ahorro">Fondo de Ahorro</option>
              </select>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Monto">
            {(inputProps) => (
              <MoneyInput
                {...inputProps}
                name="amount"
                required
                value={formData.amount}
                onChange={(v) => setFormData((p) => ({ ...p, amount: v }))}
              />
            )}
          </Field>
          <Field label="Fecha">
            {(inputProps) => (
              <Input
                {...inputProps}
                type="date"
                name="date"
                required
                icon={<CalendarIcon className="w-4 h-4" />}
                value={formData.date}
                onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
              />
            )}
          </Field>
        </div>

        <Field label="Descripción" optional>
          {(inputProps) => (
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <Textarea
                {...inputProps}
                name="description"
                className="pl-10"
                placeholder="Ej: Aporte mensual al fondo de ahorro"
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          )}
        </Field>

        <p className="text-xs text-muted">
          Genera un egreso en el fondo origen y un ingreso en el fondo destino. El saldo total
          del centro no cambia.
        </p>
      </form>
    </Dialog>
  );
}
