"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar as CalendarIcon, AlignLeft, Target } from "lucide-react";
import { createEvent, updateEvent } from "@/app/actions/events";
import { toDateInputValue, todayDateInputValue } from "@/lib/date-only";
import type { EventSummary } from "@/lib/finance/types";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

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
    date: todayDateInputValue(),
    goal: "",
    description: "",
  });

  useEffect(() => {
    if (!isOpen) return;

    if (event) {
      setFormData({
        name: event.name,
        date: toDateInputValue(event.date),
        goal: event.goal ? event.goal.toString() : "",
        description: event.description ?? "",
      });
    } else {
      setFormData({
        name: "",
        date: todayDateInputValue(),
        goal: "",
        description: "",
      });
    }
  }, [isOpen, event]);

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
      toast.success(isEditing ? "Actividad actualizada" : "Actividad creada");
      onSaved?.();
      onClose();
    } else {
      toast.error(result.error ?? "No pudimos guardar la actividad.");
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar actividad" : "Nueva actividad"}
      footer={
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="event-form" size="md" loading={isSubmitting} loadingText="Guardando...">
            {isEditing ? "Actualizar actividad" : "Crear actividad"}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          {(inputProps) => (
            <Input
              {...inputProps}
              name="name"
              required
              placeholder="Ej: Bingo 2026, Rifa Día de la Madre"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Fecha">
            {(inputProps) => (
              <Input
                {...inputProps}
                type="date"
                required
                icon={<CalendarIcon className="w-4 h-4" />}
                value={formData.date}
                onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Meta de recaudación" optional>
            {(inputProps) => (
              <Input
                {...inputProps}
                type="number"
                min="0"
                step="1000"
                placeholder="Sin meta definida"
                icon={<Target className="w-4 h-4" />}
                value={formData.goal}
                onChange={(e) => setFormData((p) => ({ ...p, goal: e.target.value }))}
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
                className="pl-10"
                placeholder="Detalles de la actividad..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          )}
        </Field>
      </form>
    </Dialog>
  );
}
