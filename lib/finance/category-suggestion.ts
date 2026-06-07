import { MovementType } from "@prisma/client";
import { inferCategoryCode } from "@/lib/category-inference";
import { isPoorlyCategorized, type CategorizableRecord } from "./categorization-quality";
import type { CategoryOption } from "./types";

const FALLBACK_CODES = new Set(["OTROS", "OTROS_GASTO"]);

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  categoryCode: string;
}

export function getCategorySuggestion(
  record: CategorizableRecord & { description: string },
  categories: CategoryOption[]
): CategorySuggestion | null {
  if (!isPoorlyCategorized(record)) return null;

  const movementType = record.type === "Ingreso" ? MovementType.INCOME : MovementType.EXPENSE;
  const code = inferCategoryCode(record.description, movementType);

  if (FALLBACK_CODES.has(code)) return null;
  if (record.categoryCode === code) return null;

  const match = categories.find((cat) => cat.code === code);
  if (!match) return null;

  return {
    categoryId: match.id,
    categoryName: match.name,
    categoryCode: match.code,
  };
}
