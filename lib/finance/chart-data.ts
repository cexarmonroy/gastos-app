import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toCalendarDate } from "@/lib/date-only";
import type { DashboardPeriod } from "./period-filter";
import type { MovementRecord } from "./types";

export interface FlowChartPoint {
  name: string;
  sortKey: string;
  ingresos: number;
  egresos: number;
}

export interface BalanceChartPoint {
  name: string;
  sortKey: string;
  saldo: number;
}

function getBucket(date: Date, period: DashboardPeriod): { sortKey: string; label: string } {
  if (period === "month") {
    const sortKey = format(date, "yyyy-MM-dd");
    return { sortKey, label: format(date, "d MMM", { locale: es }) };
  }

  const sortKey = format(date, "yyyy-MM");
  return { sortKey, label: format(date, "MMM yy", { locale: es }) };
}

export function buildFlowChartData(
  records: MovementRecord[],
  period: DashboardPeriod
): FlowChartPoint[] {
  const buckets = new Map<string, FlowChartPoint & { label: string }>();

  for (const record of records) {
    try {
      const date = toCalendarDate(record.date);
      const { sortKey, label } = getBucket(date, period);
      const existing = buckets.get(sortKey);
      const isIngreso = record.type === "Ingreso";
      const amount = Math.abs(record.amount);

      if (existing) {
        if (isIngreso) existing.ingresos += amount;
        else existing.egresos += amount;
      } else {
        buckets.set(sortKey, {
          name: label,
          sortKey,
          label,
          ingresos: isIngreso ? amount : 0,
          egresos: !isIngreso ? amount : 0,
        });
      }
    } catch {
      // Ignorar fechas inválidas
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ name, sortKey, ingresos, egresos }) => ({ name, sortKey, ingresos, egresos }));
}

export interface WeeklyFlowPoint {
  name: string;
  weekIndex: number;
  total: number;
}

/** Agrupa movimientos (ya acotados a un mes) por semana calendario del mes, sumando volumen total (ingresos + egresos). */
export function buildWeeklyFlowData(records: MovementRecord[]): WeeklyFlowPoint[] {
  const weeks = new Map<number, number>();

  for (const record of records) {
    try {
      const date = toCalendarDate(record.date);
      const weekIndex = Math.ceil(date.getDate() / 7);
      weeks.set(weekIndex, (weeks.get(weekIndex) ?? 0) + Math.abs(record.amount));
    } catch {
      // Ignorar fechas inválidas
    }
  }

  return Array.from(weeks.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, total]) => ({
      name: `Sem ${weekIndex}`,
      weekIndex,
      total,
    }));
}

export function buildWeeklyInsight(
  points: WeeklyFlowPoint[]
): { weekLabel: string; percent: number } | null {
  if (points.length < 2) return null;

  const grandTotal = points.reduce((acc, p) => acc + p.total, 0);
  if (grandTotal <= 0) return null;

  const topWeek = points.reduce((best, current) => (current.total > best.total ? current : best));
  const percent = Math.round((topWeek.total / grandTotal) * 100);

  return { weekLabel: topWeek.name, percent };
}

export function buildBalanceChartData(records: MovementRecord[]): BalanceChartPoint[] {
  const sorted = [...records].sort(
    (a, b) => toCalendarDate(a.date).getTime() - toCalendarDate(b.date).getTime()
  );

  const monthTotals = new Map<string, { label: string; delta: number }>();
  let runningBalance = 0;

  for (const record of sorted) {
    try {
      const date = toCalendarDate(record.date);
      const sortKey = format(date, "yyyy-MM");
      const label = format(date, "MMM yy", { locale: es });
      runningBalance += record.amount;

      const existing = monthTotals.get(sortKey);
      if (existing) {
        existing.delta = runningBalance;
      } else {
        monthTotals.set(sortKey, { label, delta: runningBalance });
      }
    } catch {
      // Ignorar fechas inválidas
    }
  }

  return Array.from(monthTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sortKey, { label, delta }]) => ({
      name: label,
      sortKey,
      saldo: delta,
    }));
}
