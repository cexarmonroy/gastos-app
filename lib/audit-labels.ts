export const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Creó",
  UPDATE: "Editó",
  DELETE: "Anuló / eliminó",
  EXPORT: "Exportó",
  IMPORT: "Importó",
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  movements: "Movimiento",
  attachments: "Adjunto",
  transfers: "Transferencia",
  projects: "Proyecto",
  events: "Actividad",
  reconciliation: "Conciliación",
};

const FIELD_LABELS: Record<string, string> = {
  date: "Fecha",
  amount: "Monto",
  movementType: "Tipo",
  description: "Descripción",
  fundCode: "Fondo",
  categoryCode: "Categoría",
  fileName: "Archivo",
  attachmentType: "Tipo evidencia",
  fileSize: "Tamaño",
  movementId: "Movimiento",
};

export function formatAuditEntity(entity: string): string {
  return AUDIT_ENTITY_LABELS[entity] ?? entity;
}

export function formatAuditField(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

export function formatAuditValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (key === "movementType") {
    return value === "INCOME" ? "Ingreso" : value === "EXPENSE" ? "Egreso" : String(value);
  }
  if (key === "amount" && typeof value === "string") {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return `$${num.toLocaleString("es-CL")}`;
    }
  }
  if (key === "fileSize" && typeof value === "number") {
    return `${Math.round(value / 1024)} KB`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function auditSnapshotToLines(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object") {
    return [];
  }

  return Object.entries(snapshot as Record<string, unknown>).map(
    ([key, value]) => `${formatAuditField(key)}: ${formatAuditValue(key, value)}`
  );
}
