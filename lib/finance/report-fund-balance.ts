import {
  endOfMonth,
  endOfYear,
  parseISO,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { computeFundBalance } from "./map-movement";
import {
  areReportFiltersValid,
  type ReportFilters,
  type ReportFundFilter,
  type ReportType,
} from "./report-filter";
import type { FundTab, MovementRecord } from "./types";

export interface FundBalanceLine {
  saldoInicial: number;
  saldoFinal: number;
  cambioSaldo: number;
}

export interface FundBalanceSnapshot {
  fundLabel: string;
  saldoInicial: number;
  saldoFinal: number;
  cambioSaldo: number;
  cajaChica: FundBalanceLine | null;
  fondoAhorro: FundBalanceLine | null;
}

const FUND_LABELS: Record<ReportFundFilter, string> = {
  todos: "Todos los fondos",
  caja_chica: "Caja Chica",
  fondo_ahorro: "Fondo de Ahorro",
};

export function supportsFundBalanceSnapshot(reportType: ReportType): boolean {
  return (
    reportType === "mensual" ||
    reportType === "anual" ||
    reportType === "actividad" ||
    reportType === "personalizado"
  );
}

export function getReportPeriodBounds(
  filters: ReportFilters
): { start: Date; end: Date } | null {
  if (!areReportFiltersValid(filters) || !supportsFundBalanceSnapshot(filters.reportType)) {
    return null;
  }

  if (
    (filters.reportType === "mensual" || filters.reportType === "actividad") &&
    filters.selectedMonth
  ) {
    const ref = parseISO(`${filters.selectedMonth}-01`);
    return { start: startOfMonth(ref), end: endOfMonth(ref) };
  }

  if (filters.reportType === "anual" && filters.selectedYear) {
    const ref = parseISO(`${filters.selectedYear}-01-01`);
    return { start: startOfYear(ref), end: endOfYear(ref) };
  }

  if (filters.reportType === "personalizado" && filters.startDate && filters.endDate) {
    return {
      start: parseISO(filters.startDate),
      end: parseISO(`${filters.endDate}T23:59:59`),
    };
  }

  return null;
}

function filterThroughDate(records: MovementRecord[], through: Date): MovementRecord[] {
  return records.filter((record) => parseISO(record.date) <= through);
}

function filterBeforeDate(records: MovementRecord[], before: Date): MovementRecord[] {
  return records.filter((record) => parseISO(record.date) < before);
}

function computeLine(
  beforeRecords: MovementRecord[],
  throughRecords: MovementRecord[],
  tab: FundTab
): FundBalanceLine {
  const saldoInicial = computeFundBalance(beforeRecords, tab);
  const saldoFinal = computeFundBalance(throughRecords, tab);
  return {
    saldoInicial,
    saldoFinal,
    cambioSaldo: saldoFinal - saldoInicial,
  };
}

export function computeFundBalanceSnapshot(
  allRecords: MovementRecord[],
  filters: ReportFilters
): FundBalanceSnapshot | null {
  const bounds = getReportPeriodBounds(filters);
  if (!bounds) return null;

  const throughRecords = filterThroughDate(allRecords, bounds.end);
  const beforeRecords = filterBeforeDate(allRecords, bounds.start);

  const cajaChica = computeLine(beforeRecords, throughRecords, "caja_chica");
  const fondoAhorro = computeLine(beforeRecords, throughRecords, "fondo_ahorro");

  if (filters.selectedFund === "caja_chica") {
    return {
      fundLabel: FUND_LABELS.caja_chica,
      ...cajaChica,
      cajaChica: null,
      fondoAhorro: null,
    };
  }

  if (filters.selectedFund === "fondo_ahorro") {
    return {
      fundLabel: FUND_LABELS.fondo_ahorro,
      ...fondoAhorro,
      cajaChica: null,
      fondoAhorro: null,
    };
  }

  return {
    fundLabel: FUND_LABELS.todos,
    saldoInicial: cajaChica.saldoInicial + fondoAhorro.saldoInicial,
    saldoFinal: cajaChica.saldoFinal + fondoAhorro.saldoFinal,
    cambioSaldo: cajaChica.cambioSaldo + fondoAhorro.cambioSaldo,
    cajaChica,
    fondoAhorro,
  };
}
