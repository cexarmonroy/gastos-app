import type { MovementRecord } from "./types";

const FUND_LABELS: Record<string, string> = {
  caja_chica: "Caja Chica",
  fondo_ahorro: "Fondo de Ahorro",
};

export function getMovementDisplayLabel(record: MovementRecord): string {
  if (record.transferId) {
    const fund = FUND_LABELS[record.category] ?? record.fundName;
    if (record.type === "Egreso") {
      return `Transferencia desde ${fund}`;
    }
    return `Transferencia a ${fund}`;
  }

  if (record.eventName) {
    const prefix = record.type === "Ingreso" ? "Ingreso" : "Gasto";
    return `${prefix} — ${record.eventName}`;
  }

  if (record.projectName) {
    const prefix = record.type === "Ingreso" ? "Aporte" : "Gasto";
    return `${prefix} — ${record.projectName}`;
  }

  if (record.description?.trim()) {
    return record.description.trim();
  }

  if (record.categoryName) {
    return record.categoryName;
  }

  return "Sin descripción";
}

export function getMovementSubtitle(record: MovementRecord): string | null {
  const parts: string[] = [];

  if (record.categoryName && !record.description?.includes(record.categoryName)) {
    parts.push(record.categoryName);
  }

  const fund = FUND_LABELS[record.category];
  if (fund) {
    parts.push(fund);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}
