"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlignLeft, Flag } from "lucide-react";
import { createProject, updateProject } from "@/app/actions/projects";
import { PROJECT_FUNDING_MODE_LABELS } from "@/lib/finance/project-labels";
import type { ProjectFundingMode, ProjectStatus, ProjectSummary } from "@/lib/finance/types";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";

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
      toast.success(isEditing ? "Proyecto actualizado" : "Proyecto creado");
      onSaved?.();
      onClose();
    } else {
      toast.error(result.error ?? "No pudimos guardar el proyecto.");
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar proyecto" : "Nuevo proyecto"}
      footer={
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="project-form" size="md" loading={isSubmitting} loadingText="Guardando...">
            {isEditing ? "Actualizar proyecto" : "Crear proyecto"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre del proyecto">
          {(inputProps) => (
            <input
              {...inputProps}
              required
              placeholder="Ej: Techar Patio, Juegos Infantiles"
              className="input-premium"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            />
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={formData.fundingMode === "EXECUTION" ? "Presupuesto" : "Meta"}>
            {(inputProps) => (
              <MoneyInput
                {...inputProps}
                required
                value={formData.targetAmount}
                onChange={(v) => setFormData((p) => ({ ...p, targetAmount: v }))}
              />
            )}
          </Field>
          <Field label="Estado">
            {(inputProps) => (
              <select
                {...inputProps}
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
            )}
          </Field>
        </div>

        <Field
          label="Tipo de proyecto"
          hint={
            formData.fundingMode === "FUNDRAISING"
              ? "Hay que juntar fondos hacia una meta; el avance se mide con ingresos vinculados."
              : "Se paga con saldo ya acumulado; el seguimiento muestra el gasto ejecutado."
          }
        >
          {(inputProps) => (
            <div className="relative">
              <Flag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <select
                {...inputProps}
                className="select-premium pl-10 w-full"
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
            </div>
          )}
        </Field>

        <Field
          label="Descripción"
          optional
          hint={
            formData.fundingMode === "FUNDRAISING"
              ? "Vincula ingresos del Fondo de Ahorro para avanzar hacia la meta."
              : "Vincula los egresos del Fondo de Ahorro para registrar la inversión ejecutada."
          }
        >
          {(inputProps) => (
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <Textarea
                {...inputProps}
                className="pl-10"
                placeholder="Objetivo e hitos del proyecto..."
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
