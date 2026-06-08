import type { CategoryBreakdownItem } from "./category-breakdown";
import type { ReportType } from "./report-filter";
import type { MovementRecord } from "./types";

export interface ReportDriver {
  label: string;
  amount: number;
  sharePercent: number;
}

export interface ExecutiveSummary {
  fundLabel: string;
  topIncomes: ReportDriver[];
  topExpenses: ReportDriver[];
  mainActivity: { name: string; income: number } | null;
  mainProject: { name: string; income: number } | null;
  filteredActivityName: string | null;
  filteredProjectName: string | null;
}

export interface ExportContentItem {
  label: string;
  included: boolean;
}

const FUND_LABELS: Record<string, string> = {
  todos: "Todos los fondos",
  caja_chica: "Caja Chica",
  fondo_ahorro: "Fondo de Ahorro",
};

function toDrivers(
  items: CategoryBreakdownItem[],
  total: number,
  limit = 3
): ReportDriver[] {
  return items.slice(0, limit).map((item) => ({
    label: item.categoryName,
    amount: item.total,
    sharePercent: total > 0 ? Math.round((item.total / total) * 100) : 0,
  }));
}

function aggregateByField(
  records: MovementRecord[],
  field: "eventId" | "projectId",
  nameField: "eventName" | "projectName",
  type: "Ingreso" | "Egreso"
) {
  const map = new Map<string, { name: string; total: number }>();

  for (const record of records) {
    if (record.type !== type) continue;
    const id = record[field];
    if (!id) continue;

    const name = record[nameField] ?? "Sin nombre";
    const existing = map.get(id);
    const amount = Math.abs(record.amount);

    if (existing) {
      existing.total += amount;
    } else {
      map.set(id, { name, total: amount });
    }
  }

  const top = Array.from(map.values()).sort((a, b) => b.total - a.total)[0];
  return top ? { name: top.name, income: top.total } : null;
}

export function buildExecutiveSummary(
  operational: MovementRecord[],
  incomeBreakdown: CategoryBreakdownItem[],
  expenseBreakdown: CategoryBreakdownItem[],
  totalIngresos: number,
  totalEgresos: number,
  selectedFund: string,
  filteredActivityName: string | null,
  filteredProjectName: string | null
): ExecutiveSummary {
  return {
    fundLabel: FUND_LABELS[selectedFund] ?? selectedFund,
    topIncomes: toDrivers(incomeBreakdown, totalIngresos),
    topExpenses: toDrivers(expenseBreakdown, totalEgresos),
    mainActivity: aggregateByField(operational, "eventId", "eventName", "Ingreso"),
    mainProject: aggregateByField(operational, "projectId", "projectName", "Ingreso"),
    filteredActivityName,
    filteredProjectName,
  };
}

export function getExportContents(options: {
  reportType: ReportType;
  hasTransfers: boolean;
  hasEventFilter: boolean;
  hasProjectFilter: boolean;
  format: "pdf" | "csv";
}): ExportContentItem[] {
  const { reportType, hasTransfers, hasEventFilter, hasProjectFilter, format } = options;

  if (format === "csv") {
    return [
      { label: "Tabla de movimientos (fecha, fondo, categoría, actividad)", included: true },
      { label: "Transferencias identificadas", included: true },
    ];
  }

  if (reportType === "asamblea") {
    return [
      { label: "Saldos de tesorería (Caja Chica y Fondo de Ahorro)", included: true },
      { label: "Resultado anual sin transferencias", included: true },
      { label: "Actividades del año con meta y ganancia", included: true },
      { label: "Proyectos del año con avance", included: true },
      { label: "Top categorías de ingresos y gastos", included: true },
      { label: "Detalle movimiento a movimiento", included: false },
      { label: "Gráficos", included: false },
    ];
  }

  if (reportType === "actividad") {
    return [
      { label: "Resumen de la actividad (ingresos, gastos, ganancia, ROI)", included: true },
      { label: "Saldo inicial y final del fondo", included: true },
      { label: "Meta vs real y avance", included: hasEventFilter },
      { label: "Desglose por categoría", included: true },
      { label: "Detalle de movimientos", included: true },
      { label: "Transferencias internas (si hay)", included: hasTransfers },
      { label: "Gráficos", included: false },
    ];
  }

  return [
    { label: "Resumen ejecutivo del período", included: true },
    { label: "Saldo inicial y final del fondo", included: true },
    { label: "Desglose por categoría", included: true },
    { label: "Detalle de movimientos", included: true },
    { label: "Transferencias internas (si hay)", included: hasTransfers },
    { label: "Meta vs real de actividad", included: hasEventFilter },
    { label: "Filtro por proyecto reflejado", included: hasProjectFilter },
    { label: "Gráficos", included: false },
  ];
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("es-CL")}`;
}

export function formatShareOfTotal(
  percent: number,
  kind: "ingresos" | "gastos"
): string {
  return `${percent}% del total de ${kind}`;
}
