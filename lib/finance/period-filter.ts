import {
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { es } from "date-fns/locale";
import type { MovementRecord } from "./types";

export type DashboardPeriod = "month" | "year" | "all";

function parseRecordDate(date: string): Date {
  return parseISO(date);
}

export function filterRecordsByPeriod(
  records: MovementRecord[],
  period: DashboardPeriod,
  referenceDate = new Date()
): MovementRecord[] {
  if (period === "all") return records;

  const start =
    period === "month" ? startOfMonth(referenceDate) : startOfYear(referenceDate);
  const end = period === "month" ? endOfMonth(referenceDate) : endOfYear(referenceDate);

  return records.filter((record) => {
    const date = parseRecordDate(record.date);
    return date >= start && date <= end;
  });
}

export function getPeriodLabel(period: DashboardPeriod, referenceDate = new Date()): string {
  if (period === "month") {
    return format(referenceDate, "MMMM yyyy", { locale: es });
  }
  if (period === "year") {
    return format(referenceDate, "yyyy", { locale: es });
  }
  return "Histórico completo";
}

export function sumIncome(records: MovementRecord[]): number {
  return records
    .filter((r) => r.type === "Ingreso")
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);
}

export function sumExpense(records: MovementRecord[]): number {
  return records
    .filter((r) => r.type === "Egreso")
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);
}
