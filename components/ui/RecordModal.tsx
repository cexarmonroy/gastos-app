"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { X, Calendar as CalendarIcon, AlignLeft, DollarSign, PartyPopper, HardHat } from "lucide-react";
import { getEventOptions } from "@/app/actions/events";
import { getProjectOptions } from "@/app/actions/projects";
import { createMovement, getCategoryOptions, updateMovement } from "@/app/actions/movements";
import { getDefaultCategoryCodeForMovementLabel } from "@/lib/finance/event-category";
import { AttachmentPanel } from "@/components/ui/AttachmentPanel";
import type { CategoryOption, EventOption, FundTab, MovementRecord, ProjectOption } from "@/lib/finance/types";

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  record?: MovementRecord | null;
  defaultEventId?: string;
  defaultProjectId?: string;
  defaultFund?: FundTab;
  defaultType?: "Ingreso" | "Egreso";
}

export function RecordModal({
  isOpen,
  onClose,
  onSaved,
  record,
  defaultEventId,
  defaultProjectId,
  defaultFund,
  defaultType,
}: RecordModalProps) {
  const { data: session } = useSession();
  const isAdminOrDirectiva =
    session?.user?.role === "ADMIN" || session?.user?.role === "DIRECTIVA";
  const isEditing = Boolean(record?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [formData, setFormData] = useState({
    amount: "",
    type: "Ingreso" as "Ingreso" | "Egreso",
    description: "",
    fund: "caja_chica" as FundTab,
    categoryId: "",
    eventId: "",
    projectId: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (!isOpen) return;

    if (record) {
      setFormData({
        amount: Math.abs(record.amount).toString(),
        type: record.type,
        description: record.description,
        fund: record.category,
        categoryId: record.categoryId ?? "",
        eventId: record.eventId ?? "",
        projectId: record.projectId ?? "",
        date: new Date(record.date).toISOString().split("T")[0],
      });
    } else {
      setFormData({
        amount: "",
        type: defaultType ?? "Ingreso",
        description: "",
        fund: defaultFund ?? "caja_chica",
        categoryId: "",
        eventId: defaultEventId ?? "",
        projectId: defaultProjectId ?? "",
        date: new Date().toISOString().split("T")[0],
      });
    }
  }, [isOpen, record, defaultEventId, defaultProjectId, defaultFund, defaultType]);

  useEffect(() => {
    if (!isOpen) return;
    getCategoryOptions(formData.type).then(setCategories);
    getEventOptions().then(setEvents);
    getProjectOptions().then(setProjects);
  }, [isOpen, formData.type]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      amount: Number(formData.amount),
      type: formData.type,
      description: formData.description,
      fund: formData.fund,
      categoryId: formData.categoryId || undefined,
      eventId: formData.eventId || undefined,
      projectId: formData.projectId || undefined,
      date: formData.date,
    };

    const result =
      isEditing && record
        ? await updateMovement({ id: record.id, ...payload })
        : await createMovement(payload);

    if (result.success) {
      onSaved?.();
      onClose();
    } else {
      alert("Error al guardar: " + result.error);
    }

    setIsSubmitting(false);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "fund" && value !== "fondo_ahorro") {
        next.projectId = "";
      }
      if ((name === "eventId" && value) || (name === "type" && next.eventId)) {
        const code = getDefaultCategoryCodeForMovementLabel(
          (name === "type" ? value : next.type) as "Ingreso" | "Egreso"
        );
        const match = categories.find((cat) => cat.code === code);
        if (match) next.categoryId = match.id;
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="modal-panel animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
          <h2 className="text-xl font-bold">{isEditing ? "Editar Registro" : "Nuevo Registro"}</h2>
          <button
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
                  className="input-premium pl-10"
                  value={formData.amount}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Tipo</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="select-premium py-[11px]"
              >
                <option value="Ingreso">Ingreso</option>
                <option value="Egreso">Egreso</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">Descripción</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-white/40" />
              <textarea
                name="description"
                required
                className="input-premium pl-10 resize-none min-h-[80px]"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Fondo</label>
              <select
                name="fund"
                value={formData.fund}
                onChange={handleChange}
                className="select-premium py-[11px]"
              >
                <option value="caja_chica">Caja Chica</option>
                <option value="fondo_ahorro">Fondo de Ahorro</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Categoría</label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="select-premium py-[11px]"
              >
                <option value="">Automática (Otros)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formData.fund === "fondo_ahorro" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <HardHat className="w-4 h-4 text-accent" />
                Proyecto (opcional)
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleChange}
                className="select-premium py-[11px]"
              >
                <option value="">Sin proyecto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80 flex items-center gap-2">
              <PartyPopper className="w-4 h-4 text-accent" />
              Actividad (opcional)
            </label>
            <select
              name="eventId"
              value={formData.eventId}
              onChange={handleChange}
              className="select-premium py-[11px]"
            >
              <option value="">Sin actividad</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
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

          {isEditing && record?.id && isAdminOrDirectiva && (
            <AttachmentPanel movementId={record.id} />
          )}

          <div className="pt-6 border-t border-white/10 flex items-center justify-end gap-3 bg-white/5 -mx-6 -mb-6 p-6 rounded-b-2xl">
            <button type="button" onClick={onClose} className="btn-secondary px-5 py-2">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary px-5 py-2 disabled:opacity-50">
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
