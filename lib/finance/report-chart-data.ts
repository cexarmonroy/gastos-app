import type { CategoryBreakdownItem } from "./category-breakdown";

const CHART_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#94a3b8",
];

export interface CategoryPiePoint {
  name: string;
  value: number;
  fill: string;
}

export interface FlowSummaryBarPoint {
  name: string;
  monto: number;
  fill: string;
}

export function buildCategoryPieData(
  items: CategoryBreakdownItem[],
  limit = 6
): CategoryPiePoint[] {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit);

  const data: CategoryPiePoint[] = top.map((item, index) => ({
    name: item.categoryName,
    value: item.total,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (rest.length > 0) {
    data.push({
      name: "Otros",
      value: rest.reduce((sum, item) => sum + item.total, 0),
      fill: CHART_COLORS[CHART_COLORS.length - 1],
    });
  }

  return data;
}

export function buildFlowSummaryBarData(
  ingresos: number,
  egresos: number
): FlowSummaryBarPoint[] {
  return [
    { name: "Ingresos", monto: ingresos, fill: "#22c55e" },
    { name: "Egresos", monto: egresos, fill: "#ef4444" },
  ];
}
