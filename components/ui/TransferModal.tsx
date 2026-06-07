"use client";

import { useState } from "react";
import { X, Calendar as CalendarIcon, AlignLeft, DollarSign, ArrowRightLeft } from "lucide-react";
import { createTransfer } from "@/app/actions/transfers";
import type { FundTab } from "@/lib/finance/types";

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
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  if (!isOpen) return null;

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
      onSaved?.();
      onClose();
      setFormData({
        fromFund: "caja_chica",
        toFund: "fondo_ahorro",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
    } else {
      alert("Error al guardar: " + result.error);
    }

    setIsSubmitting(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="modal-panel animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-bold">Nueva Transferencia</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Desde</label>
              <select
                name="fromFund"
                value={formData.fromFund}
                onChange={handleChange}
                className="select-premium py-[11px]"
              >
                <option value="caja_chica">Caja Chica</option>
                <option value="fondo_ahorro">Fondo de Ahorro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Hacia</label>
              <select
                name="toFund"
                value={formData.toFund}
                onChange={handleChange}
                className="select-premium py-[11px]"
              >
                <option value="caja_chica">Caja Chica</option>
                <option value="fondo_ahorro">Fondo de Ahorro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Monto</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  required
                  min="0.01"
                  className="input-premium pl-10"
                  value={formData.amount}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Fecha</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="date"
                  name="date"
                  required
                  className="input-premium pl-10 [&::-webkit-calendar-picker-indicator]:invert-[0.8]"
                  value={formData.date}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">Descripción</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-white/40" />
              <textarea
                name="description"
                className="input-premium pl-10 resize-none min-h-[70px]"
                placeholder="Ej: Aporte mensual al fondo de ahorro"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          <p className="text-[11px] text-white/40">
            Genera un egreso en el fondo origen y un ingreso en el fondo destino. El saldo total
            del centro no cambia.
          </p>

          <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary px-5 py-2 disabled:opacity-50">
              {isSubmitting ? "Guardando..." : "Transferir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
