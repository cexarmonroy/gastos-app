import { MovementType, type Category, type Fund, type FundraisingEvent, type Movement, type Project } from "@prisma/client";
import { FUND_CODE_TO_TAB, type FundTab, type MovementRecord } from "./types";

type MovementWithRelations = Movement & {
  fund: Fund;
  category: Category | null;
  event?: FundraisingEvent | null;
  project?: Project | null;
};

export function movementTypeToLabel(type: MovementType): "Ingreso" | "Egreso" {
  return type === MovementType.INCOME ? "Ingreso" : "Egreso";
}

export function labelToMovementType(type: "Ingreso" | "Egreso"): MovementType {
  return type === "Ingreso" ? MovementType.INCOME : MovementType.EXPENSE;
}

export function signedAmount(type: MovementType, amount: number | { toNumber(): number }): number {
  const value = typeof amount === "number" ? amount : amount.toNumber();
  return type === MovementType.EXPENSE ? -Math.abs(value) : Math.abs(value);
}

export function toMovementRecord(movement: MovementWithRelations): MovementRecord {
  const tab = FUND_CODE_TO_TAB[movement.fund.code] ?? "caja_chica";
  const tags = movement.category?.name ? [movement.category.name] : ["app"];

  return {
    id: movement.id,
    date: movement.date.toISOString(),
    amount: signedAmount(movement.movementType, movement.amount),
    type: movementTypeToLabel(movement.movementType),
    description: movement.description ?? "",
    status: "COMPLETED",
    tags: JSON.stringify(tags),
    category: tab,
    categoryId: movement.categoryId,
    categoryName: movement.category?.name ?? null,
    categoryCode: movement.category?.code ?? null,
    fundName: movement.fund.name,
    transferId: movement.transferId,
    eventId: movement.eventId,
    eventName: movement.event?.name ?? null,
    projectId: movement.projectId,
    projectName: movement.project?.name ?? null,
  };
}

export function computeFundBalance(records: MovementRecord[], tab: FundTab): number {
  return records
    .filter((record) => record.category === tab)
    .reduce((total, record) => total + record.amount, 0);
}
