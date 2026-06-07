import type { MovementRecord } from "./types";

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  categoryCode: string | null;
  type: "Ingreso" | "Egreso";
  total: number;
  count: number;
}

export function buildCategoryBreakdown(records: MovementRecord[]): CategoryBreakdownItem[] {
  const map = new Map<string, CategoryBreakdownItem>();

  for (const record of records) {
    const key = record.categoryId ?? `unknown-${record.type}`;
    const existing = map.get(key);

    if (existing) {
      existing.total += Math.abs(record.amount);
      existing.count += 1;
    } else {
      map.set(key, {
        categoryId: record.categoryId,
        categoryName: record.categoryName ?? "Sin categoría",
        categoryCode: record.categoryCode,
        type: record.type,
        total: Math.abs(record.amount),
        count: 1,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
