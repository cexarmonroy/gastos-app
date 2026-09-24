"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Calendar as CalendarIcon, AlignLeft, PartyPopper } from "lucide-react";
import { getEventOptions } from "@/app/actions/events";
import { getProjectOptions } from "@/app/actions/projects";
import { createMovement, getCategoryOptions, updateMovement } from "@/app/actions/movements";
import { getDefaultCategoryCodeForMovementLabel } from "@/lib/finance/event-category";
import { toDateInputValue, todayDateInputValue } from "@/lib/date-only";
import { AttachmentPanel } from "@/components/ui/AttachmentPanel";
import type { CategoryOption, EventOption, FundTab, MovementRecord, ProjectOption } from "@/lib/finance/types";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";

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
    date: todayDateInputValue(),
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
        date: toDateInputValue(record.date),
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
        date: todayDateInputValue(),
      });
    }
  }, [isOpen, record, defaultEventId, defaultProjectId, defaultFund, defaultType]);

  useEffect(() => {
    if (!isOpen) return;
    getCategoryOptions(formData.type).then(setCategories);
    getEventOptions().then(setEvents);
    getProjectOptions().then(setProjects);
  }, [isOpen, formData.type]);

  const setField = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "fund" && value !== "fondo_ahorro") {
        next.projectId = "";
      }
      if ((key === "eventId" && value) || (key === "type" && next.eventId)) {
        const code = getDefaultCategoryCodeForMovementLabel(
          (key === "type" ? value : next.type) as "Ingreso" | "Egreso"
        );
        const match = categories.find((cat) => cat.code === code);
        if (match) next.categoryId = match.id;
      }
      return next;
    });
  };

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
      toast.success(isEditing ? "Movimiento actualizado" : "Movimiento guardado");
      onSaved?.();
      onClose();
    } else {
      toast.error(result.error ?? "No pudimos guardar el movimiento.");
    }

    setIsSubmitting(false);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar movimiento" : "Nuevo movimiento"}
      footer={
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="record-form" size="md" loading={isSubmitting} loadingText="Guardando...">
            {isEditing ? "Actualizar movimiento" : "Guardar movimiento"}
          </Button>
        </>
      }
    >
      <form id="record-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Monto">
            {(inputProps) => (
              <MoneyInput
                {...inputProps}
                name="amount"
                required
                autoFocus
                value={formData.amount}
                onChange={(v) => setField("amount", v)}
              />
            )}
          </Field>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Tipo</p>
            <SegmentedControl
              aria-label="Tipo de movimiento"
              options={[
                { value: "Ingreso", label: "Ingreso" },
                { value: "Egreso", label: "Egreso" },
              ]}
              value={formData.type}
              onChange={(v) => setField("type", v)}
            />
          </div>
        </div>

        <Field label="Descripción">
          {(inputProps) => (
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-muted" />
              <Textarea
                {...inputProps}
                name="description"
                required
                className="pl-10"
                placeholder="Ej.: Compra de premios para bingo"
                value={formData.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>
          )}
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Fondo</p>
            <SegmentedControl
              aria-label="Fondo"
              options={[
                { value: "caja_chica", label: "Caja Chica" },
                { value: "fondo_ahorro", label: "Fondo de Ahorro" },
              ]}
              value={formData.fund}
              onChange={(v) => setField("fund", v)}
            />
          </div>
          <Field label="Categoría" hint="Automática: se sugerirá según la actividad">
            {(inputProps) => (
              <select
                {...inputProps}
                name="categoryId"
                value={formData.categoryId}
                onChange={(e) => setField("categoryId", e.target.value)}
                className="select-premium py-[11px]"
              >
                <option value="">Automática (Otros)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {formData.fund === "fondo_ahorro" && (
          <Field label="Proyecto" optional>
            {(inputProps) => (
              <select
                {...inputProps}
                name="projectId"
                value={formData.projectId}
                onChange={(e) => setField("projectId", e.target.value)}
                className="select-premium py-[11px]"
              >
                <option value="">Sin proyecto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <Field label="Actividad" optional>
          {(inputProps) => (
            <select
              {...inputProps}
              name="eventId"
              value={formData.eventId}
              onChange={(e) => setField("eventId", e.target.value)}
              className="select-premium py-[11px]"
            >
              <option value="">Sin actividad</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="text-xs text-subtle -mt-3 flex items-center gap-1.5">
          <PartyPopper className="w-3.5 h-3.5" />
          Vincular a una actividad o proyecto es opcional.
        </p>

        <Field label="Fecha">
          {(inputProps) => (
            <Input
              {...inputProps}
              type="date"
              name="date"
              required
              icon={<CalendarIcon className="w-4 h-4" />}
              value={formData.date}
              onChange={(e) => setField("date", e.target.value)}
            />
          )}
        </Field>

        {isEditing && record?.id && isAdminOrDirectiva && (
          <AttachmentPanel movementId={record.id} />
        )}
      </form>
    </Dialog>
  );
}
