"use client";

import { useEffect, useState } from "react";
import { X, AlignLeft, Target, Flag } from "lucide-react";
import { createProject, updateProject } from "@/app/actions/projects";
import { PROJECT_FUNDING_MODE_LABELS } from "@/lib/finance/project-labels";
import type { ProjectFundingMode, ProjectStatus, ProjectSummary } from "@/lib/finance/types";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  project?: Pick<
    ProjectSummary,
    "id" | "name" | "targetAmount" | "status" | "fundingMode" | "description"
  > | null;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "PLANNED", label: "Planificado" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export function ProjectModal({ isOpen, onClose, onSaved, project }: ProjectModalProps) {
  const isEditing = Boolean(project?.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    targetAmount: "",
    status: "PLANNED" as ProjectStatus,
    fundingMode: "FUNDRAISING" as ProjectFundingMode,
    description: "",
  });

  useEffect(() => {
    if (!isOpen) return;

    if (project) {
      setFormData({
        name: project.name,
        targetAmount: project.targetAmount.toString(),
        status: project.status,
        fundingMode: project.fundingMode,
        description: project.description ?? "",
      });
    } else {
      setFormData({
        name: "",
        targetAmount: "",
        status: "PLANNED",
        fundingMode: "FUNDRAISING",
        description: "",
      });
    }
  }, [isOpen, project]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      name: formData.name,
      targetAmount: Number(formData.targetAmount),
      status: formData.status,
      fundingMode: formData.fundingMode,
      description: formData.description,
    };

    const result =
      isEditing && project
        ? await updateProject(project.id, payload)
        : await createProject(payload);

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
          <h2 className="text-xl font-bold">{isEditing ? "Editar Proyecto" : "Nuevo Proyecto"}</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-white/80">Nombre del proyecto</label>
            <input
              required
              placeholder="Ej: Techar Patio, Juegos Infantiles"
              className="input-premium"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-white/80">
                {formData.fundingMode === "EXECUTION" ? "Presupuesto ($)" : "Meta ($)"}
              </label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="number"
                  required
                  min="1"
                  step="1000"
                  className="input-premium pl-10"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData((p) => ({ ...p, targetAmount: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-white/80">Estado</label>
              <div className="relative">
                <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <select
                  className="select-premium py-[11px]"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, status: e.target.value as ProjectStatus }))
                  }
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/80">Tipo de proyecto</label>
            <select
              className="select-premium w-full"
              value={formData.fundingMode}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  fundingMode: e.target.value as ProjectFundingMode,
                }))
              }
            >
              <option value="FUNDRAISING">{PROJECT_FUNDING_MODE_LABELS.FUNDRAISING}</option>
              <option value="EXECUTION">{PROJECT_FUNDING_MODE_LABELS.EXECUTION}</option>
            </select>
            <p className="text-[11px] text-white/40">
              {formData.fundingMode === "FUNDRAISING"
                ? "Hay que juntar fondos hacia una meta; el avance se mide con ingresos vinculados."
                : "Se paga con saldo ya acumulado; el seguimiento muestra el gasto ejecutado."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-white/80">Descripción</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-white/40" />
              <textarea
                className="input-premium pl-10 resize-none min-h-[70px]"
                placeholder="Objetivo e hitos del proyecto..."
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          <p className="text-[11px] text-white/40">
            {formData.fundingMode === "FUNDRAISING"
              ? "Vincula ingresos del Fondo de Ahorro para avanzar hacia la meta."
              : "Vincula los egresos del Fondo de Ahorro para registrar la inversión ejecutada."}
          </p>

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
