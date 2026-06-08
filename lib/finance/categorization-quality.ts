import type { MovementRecord } from "./types";

const OTROS_CODES = new Set(["OTROS", "OTROS_GASTO"]);

export type CategorizableRecord = Pick<
  MovementRecord,
  "type" | "categoryId" | "categoryCode" | "transferId"
>;

export interface CategorizationQuality {
  total: number;
  evaluableCount: number;
  transferCount: number;
  uncategorizedCount: number;
  otrosCount: number;
  otrosIngresosCount: number;
  otrosGastosCount: number;
  poorQualityCount: number;
  poorQualityPercent: number;
  uncategorizedPercent: number;
  otrosPercent: number;
}

export function isTransferMovement(record: CategorizableRecord): boolean {
  return record.transferId !== null;
}

/** Cuenta operaciones de transferencia (cada una genera 2 movimientos vinculados). */
export function countTransferOperations(
  records: Pick<MovementRecord, "transferId">[]
): number {
  const ids = new Set<string>();
  for (const record of records) {
    if (record.transferId) ids.add(record.transferId);
  }
  return ids.size;
}

/** Movimientos que sí deben tener categoría contable (excluye transferencias). */
export function isEvaluableForCategorization(record: CategorizableRecord): boolean {
  return !isTransferMovement(record);
}

export function isPoorlyCategorized(record: CategorizableRecord): boolean {
  if (isTransferMovement(record)) return false;
  if (!record.categoryId) return true;
  if (record.categoryCode && OTROS_CODES.has(record.categoryCode)) return true;
  return false;
}

export function computeCategorizationQuality(
  records: CategorizableRecord[]
): CategorizationQuality {
  const total = records.length;
  const evaluable = records.filter(isEvaluableForCategorization);
  const evaluableCount = evaluable.length;
  const transferCount = countTransferOperations(records);

  if (evaluableCount === 0) {
    return {
      total,
      evaluableCount: 0,
      transferCount,
      uncategorizedCount: 0,
      otrosCount: 0,
      otrosIngresosCount: 0,
      otrosGastosCount: 0,
      poorQualityCount: 0,
      poorQualityPercent: 0,
      uncategorizedPercent: 0,
      otrosPercent: 0,
    };
  }

  const uncategorizedCount = evaluable.filter((r) => !r.categoryId).length;
  const otrosIngresosCount = evaluable.filter((r) => r.categoryCode === "OTROS").length;
  const otrosGastosCount = evaluable.filter((r) => r.categoryCode === "OTROS_GASTO").length;
  const otrosCount = otrosIngresosCount + otrosGastosCount;
  const poorQualityCount = evaluable.filter(isPoorlyCategorized).length;

  return {
    total,
    evaluableCount,
    transferCount,
    uncategorizedCount,
    otrosCount,
    otrosIngresosCount,
    otrosGastosCount,
    poorQualityCount,
    poorQualityPercent: Math.round((poorQualityCount / evaluableCount) * 100),
    uncategorizedPercent: Math.round((uncategorizedCount / evaluableCount) * 100),
    otrosPercent: Math.round((otrosCount / evaluableCount) * 100),
  };
}
