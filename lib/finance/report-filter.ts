import {
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { es } from "date-fns/locale";
import { countTransferOperations, isTransferMovement } from "./categorization-quality";
import { sumExpense, sumIncome } from "./period-filter";
import type { FundTab, MovementRecord } from "./types";

export type ReportType =
  | "mensual"
  | "anual"
  | "asamblea"
  | "actividad"
  | "personalizado"
  | "completo";
export type ReportFundFilter = "todos" | FundTab;

export interface ReportFilters {
  reportType: ReportType;
  selectedMonth: string;
  selectedYear: string;
  startDate: string;
  endDate: string;
  selectedFund: ReportFundFilter;
  selectedClassCategory: string;
  selectedEventId: string;
  selectedProjectId: string;
}

export function isCustomDateRangeValid(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;
  return startDate <= endDate;
}

export function areReportFiltersValid(filters: ReportFilters): boolean {
  if (filters.reportType === "mensual") return !!filters.selectedMonth;
  if (filters.reportType === "actividad") {
    return !!filters.selectedMonth && !!filters.selectedEventId;
  }
  if (filters.reportType === "anual" || filters.reportType === "asamblea") {
    return !!filters.selectedYear;
  }
  if (filters.reportType === "personalizado") {
    return isCustomDateRangeValid(filters.startDate, filters.endDate);
  }
  return true;
}

export function getReportFilterError(filters: ReportFilters): string | null {
  if (filters.reportType === "actividad") {
    if (!filters.selectedEventId) return "Selecciona una actividad para generar el reporte.";
    if (!filters.selectedMonth) return "Selecciona el mes del reporte.";
  }
  if (filters.reportType === "personalizado") {
    if (!filters.startDate || !filters.endDate) {
      return "Selecciona fecha de inicio y fin.";
    }
    if (!isCustomDateRangeValid(filters.startDate, filters.endDate)) {
      return "La fecha de inicio debe ser anterior o igual a la de fin.";
    }
  }
  return null;
}

export function getReportPeriodLabel(filters: ReportFilters): string {
  if (filters.reportType === "mensual" && filters.selectedMonth) {
    return format(parseISO(`${filters.selectedMonth}-01`), "MMMM yyyy", { locale: es });
  }
  if (filters.reportType === "anual" && filters.selectedYear) {
    return `Año ${filters.selectedYear}`;
  }
  if (filters.reportType === "asamblea" && filters.selectedYear) {
    return `Asamblea ${filters.selectedYear}`;
  }
  if (filters.reportType === "actividad" && filters.selectedMonth) {
    return format(parseISO(`${filters.selectedMonth}-01`), "MMMM yyyy", { locale: es });
  }
  if (filters.reportType === "personalizado" && areReportFiltersValid(filters)) {
    return `${format(parseISO(filters.startDate), "dd/MM/yyyy", { locale: es })} – ${format(parseISO(filters.endDate), "dd/MM/yyyy", { locale: es })}`;
  }
  return "Histórico completo";
}

function applyDateFilter(records: MovementRecord[], filters: ReportFilters): MovementRecord[] {
  if (
    (filters.reportType === "mensual" || filters.reportType === "actividad") &&
    filters.selectedMonth
  ) {
    const monthStart = startOfMonth(parseISO(`${filters.selectedMonth}-01`));
    const monthEnd = endOfMonth(parseISO(`${filters.selectedMonth}-01`));
    return records.filter((r) => {
      const recordDate = parseISO(r.date);
      return recordDate >= monthStart && recordDate <= monthEnd;
    });
  }

  if (
    (filters.reportType === "anual" || filters.reportType === "asamblea") &&
    filters.selectedYear
  ) {
    const yearStart = startOfYear(parseISO(`${filters.selectedYear}-01-01`));
    const yearEnd = endOfYear(parseISO(`${filters.selectedYear}-01-01`));
    return records.filter((r) => {
      const recordDate = parseISO(r.date);
      return recordDate >= yearStart && recordDate <= yearEnd;
    });
  }

  if (filters.reportType === "personalizado") {
    return records.filter((r) => {
      const recordDate = format(parseISO(r.date), "yyyy-MM-dd");
      return recordDate >= filters.startDate && recordDate <= filters.endDate;
    });
  }

  return records;
}

export function filterRecordsForReport(
  records: MovementRecord[],
  filters: ReportFilters
): MovementRecord[] {
  if (!areReportFiltersValid(filters)) return [];

  let filtered = records;

  if (filters.selectedFund !== "todos") {
    filtered = filtered.filter((r) => r.category === filters.selectedFund);
  }

  if (filters.selectedClassCategory) {
    filtered = filtered.filter((r) => r.categoryId === filters.selectedClassCategory);
  }

  if (filters.selectedEventId) {
    filtered = filtered.filter((r) => r.eventId === filters.selectedEventId);
  }

  if (filters.selectedProjectId) {
    filtered = filtered.filter((r) => r.projectId === filters.selectedProjectId);
  }

  return applyDateFilter(filtered, filters);
}

export function splitOperationalAndTransfers(records: MovementRecord[]) {
  const operational: MovementRecord[] = [];
  const transfers: MovementRecord[] = [];

  for (const record of records) {
    if (isTransferMovement(record)) transfers.push(record);
    else operational.push(record);
  }

  return { operational, transfers };
}

export function computeReportTotals(records: MovementRecord[]) {
  const { operational, transfers } = splitOperationalAndTransfers(records);
  const totalIngresos = sumIncome(operational);
  const totalEgresos = sumExpense(operational);

  return {
    totalIngresos,
    totalEgresos,
    resultado: totalIngresos - totalEgresos,
    transferCount: countTransferOperations(records),
    transferMovementCount: transfers.length,
    operationalCount: operational.length,
    totalCount: records.length,
    operational,
    transfers,
  };
}
