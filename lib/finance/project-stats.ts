import { MovementType } from "@prisma/client";

export interface ProjectKpis {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  movementCount: number;
  targetAmount: number;
  progress: number;
}

interface MovementLike {
  amount: number | { toNumber(): number };
  movementType: MovementType;
}

export function computeProjectKpis(
  movements: MovementLike[],
  targetAmount: number
): ProjectKpis {
  let totalIncome = 0;
  let totalExpense = 0;

  for (const movement of movements) {
    const value =
      typeof movement.amount === "number" ? movement.amount : movement.amount.toNumber();
    if (movement.movementType === MovementType.INCOME) {
      totalIncome += value;
    } else if (movement.movementType === MovementType.EXPENSE) {
      totalExpense += value;
    }
  }

  const balance = totalIncome - totalExpense;
  const progress =
    targetAmount > 0 ? Math.min(100, Math.round((totalIncome / targetAmount) * 100)) : 0;

  return {
    totalIncome,
    totalExpense,
    balance,
    movementCount: movements.length,
    targetAmount,
    progress,
  };
}
