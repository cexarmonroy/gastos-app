import { format, parseISO, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  computeReportTotals,
  filterRecordsForReport,
  getReportPeriodLabel,
  type ReportFilters,
  type ReportType,
} from "./report-filter";
import type { MovementRecord } from "./types";

export type ComparisonDirection = "up" | "down" | "flat" | "new" | "none";

export interface ComparisonMetric {
  current: number;
  previous: number;
  deltaPercent: number | null;
  direction: ComparisonDirection;
  hasPreviousData: boolean;
}

export interface PeriodComparison {
  previousLabel: string;
  ingresos: ComparisonMetric;
  egresos: ComparisonMetric;
  resultado: ComparisonMetric;
}

export function supportsPeriodComparison(reportType: ReportType): boolean {
  return reportType === "mensual" || reportType === "anual" || reportType === "actividad";
}

export function buildPreviousPeriodFilters(filters: ReportFilters): ReportFilters | null {
  if (!supportsPeriodComparison(filters.reportType)) return null;

  if (filters.reportType === "mensual" || filters.reportType === "actividad") {
    if (!filters.selectedMonth) return null;
    const previousMonth = subMonths(parseISO(`${filters.selectedMonth}-01`), 1);
    return { ...filters, selectedMonth: format(previousMonth, "yyyy-MM") };
  }

  if (filters.reportType === "anual") {
    if (!filters.selectedYear) return null;
    const year = Number.parseInt(filters.selectedYear, 10);
    if (Number.isNaN(year)) return null;
    return { ...filters, selectedYear: String(year - 1) };
  }

  return null;
}

export function getPreviousPeriodShortLabel(filters: ReportFilters): string | null {
  const previousFilters = buildPreviousPeriodFilters(filters);
  if (!previousFilters) return null;

  if (previousFilters.reportType === "mensual" || previousFilters.reportType === "actividad") {
    if (!previousFilters.selectedMonth) return null;
    return format(parseISO(`${previousFilters.selectedMonth}-01`), "MMMM", { locale: es });
  }

  if (previousFilters.reportType === "anual" && previousFilters.selectedYear) {
    return previousFilters.selectedYear;
  }

  return getReportPeriodLabel(previousFilters);
}

function computeMetric(current: number, previous: number, previousHasRecords: boolean): ComparisonMetric {
  if (!previousHasRecords) {
    return {
      current,
      previous: 0,
      deltaPercent: null,
      direction: "none",
      hasPreviousData: false,
    };
  }

  if (previous === 0 && current === 0) {
    return {
      current,
      previous,
      deltaPercent: 0,
      direction: "flat",
      hasPreviousData: true,
    };
  }

  if (previous === 0) {
    return {
      current,
      previous,
      deltaPercent: null,
      direction: "new",
      hasPreviousData: true,
    };
  }

  const deltaPercent = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const direction: ComparisonDirection =
    deltaPercent > 0 ? "up" : deltaPercent < 0 ? "down" : "flat";

  return {
    current,
    previous,
    deltaPercent,
    direction,
    hasPreviousData: true,
  };
}

export function buildPeriodComparison(
  records: MovementRecord[],
  filters: ReportFilters
): PeriodComparison | null {
  const previousFilters = buildPreviousPeriodFilters(filters);
  const previousLabel = getPreviousPeriodShortLabel(filters);
  if (!previousFilters || !previousLabel) return null;

  const currentTotals = computeReportTotals(filterRecordsForReport(records, filters));
  const previousRecords = filterRecordsForReport(records, previousFilters);
  const previousHasRecords = previousRecords.length > 0;
  const previousTotals = computeReportTotals(previousRecords);

  return {
    previousLabel,
    ingresos: computeMetric(
      currentTotals.totalIngresos,
      previousTotals.totalIngresos,
      previousHasRecords
    ),
    egresos: computeMetric(
      currentTotals.totalEgresos,
      previousTotals.totalEgresos,
      previousHasRecords
    ),
    resultado: computeMetric(
      currentTotals.resultado,
      previousTotals.resultado,
      previousHasRecords
    ),
  };
}

export function computeActivityRoi(profit: number, totalExpense: number): number | null {
  if (totalExpense <= 0) return null;
  return Math.round((profit / totalExpense) * 100);
}
