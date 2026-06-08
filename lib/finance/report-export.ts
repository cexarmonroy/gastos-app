import { format, parseISO } from "date-fns";
import type { MovementRecord } from "./types";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function fundLabel(tab: MovementRecord["category"]): string {
  return tab === "caja_chica" ? "Caja Chica" : "Fondo de Ahorro";
}

export function buildReportCsv(records: MovementRecord[]): string {
  const header = [
    "Fecha",
    "Descripción",
    "Fondo",
    "Categoría",
    "Actividad",
    "Proyecto",
    "Tipo",
    "Monto",
    "Transferencia",
  ];

  const rows = records.map((record) => [
    format(parseISO(record.date), "dd/MM/yyyy"),
    escapeCsvField(record.description || ""),
    fundLabel(record.category),
    escapeCsvField(record.categoryName ?? ""),
    escapeCsvField(record.eventName ?? ""),
    escapeCsvField(record.projectName ?? ""),
    record.transferId ? "Transferencia" : record.type,
    Math.abs(record.amount).toString(),
    record.transferId ? "Sí" : "No",
  ]);

  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function downloadCsvFile(content: string, fileName: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
