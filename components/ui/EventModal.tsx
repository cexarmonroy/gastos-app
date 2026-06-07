"use client";

import { useEffect, useState } from "react";
import { X, Calendar as CalendarIcon, AlignLeft, Target } from "lucide-react";
import { createEvent, updateEvent } from "@/app/actions/events";
import type { EventSummary } from "@/lib/finance/types";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  event?: Pick<EventSummary, "id" | "name" | "date" | "goal" | "description"> | null;
}

export function EventModal({ isOpen, onClose, onSaved, event }: EventModalProps) {
  const isEditing = Boolean(event?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    date: new Date().toISOString().split("T")[0],
    goal: "",
    description: "",
  });

  useEffect(() => {
    if (!isOpen) return;

    if (event) {
      setFormData({
        name: event.name,
        date: new Date(event.date).toISOString().split("T")[0],
        goal: event.goal ? event.goal.toString() : "",
        description: event.description ?? "",
      });
    } else {
      setFormData({
        name: "",
        date: new Date().toISOString().split("T")[0],
        goal: "",
        description: "",
      });
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      name: formData.name,
      date: formData.date,
      goal: formData.goal ? Number(formData.goal) : null,
      description: formData.description,
    };

    const result =
      isEditing && event
        ? await updateEvent(event.id, payload)
        : await createEvent(payload);

    if (result.success) {
      onSaved?.();
      onClose();
    } else {
      alert("Error: " + result.error);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-panel">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold">{isEditing ? "Editar Actividad" : "Nueva Actividad"}</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-white/80">Nombre</label>
            <input
              name="name"
              required
              placeholder="Ej: Bingo 2026, Rifa Día de la Madre"
              className="input-premium"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-white/80">Fecha</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="date"
                  required
                  className="input-premium pl-10"
                  value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-white/80">Meta recaudación</label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Opcional"
                  className="input-premium pl-10"
                  value={formData.goal}
                  onChange={(e) => setFormData((p) => ({ ...p, goal: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/80">Descripción</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-white/40" />
              <textarea
                className="input-premium pl-10 resize-none min-h-[70px]"
                placeholder="Detalles de la actividad..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary px-5 py-2 disabled:opacity-50">
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
