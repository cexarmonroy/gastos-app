import { MovementType } from "@prisma/client";

export interface EventKpis {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  movementCount: number;
  goal: number | null;
  goalProgress: number | null;
}

interface MovementLike {
  amount: number | { toNumber(): number };
  movementType: MovementType;
}

export function computeEventKpis(
  movements: MovementLike[],
  goal: number | null
): EventKpis {
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

  const profit = totalIncome - totalExpense;
  const goalProgress =
    goal && goal > 0 ? Math.min(100, Math.round((totalIncome / goal) * 100)) : null;

  return {
    totalIncome,
    totalExpense,
    profit,
    movementCount: movements.length,
    goal,
    goalProgress,
  };
}

export function kpisFromMovementRecords(
  records: Array<{ amount: number; type: "Ingreso" | "Egreso" }>,
  goal: number | null
): EventKpis {
  const movements = records.map((r) => ({
    amount: Math.abs(r.amount),
    movementType:
      r.type === "Ingreso" ? MovementType.INCOME : MovementType.EXPENSE,
  }));
  return computeEventKpis(movements, goal);
}
