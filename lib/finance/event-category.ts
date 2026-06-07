import { MovementType } from "@prisma/client";

/** Categoría contable por defecto cuando un movimiento está vinculado a una actividad. */
export function getDefaultCategoryCodeForEventMovement(movementType: MovementType): string {
  return movementType === MovementType.INCOME ? "COMPLETADA" : "EVENTOS";
}

export function getDefaultCategoryCodeForMovementLabel(type: "Ingreso" | "Egreso"): string {
  return type === "Ingreso" ? "COMPLETADA" : "EVENTOS";
}
