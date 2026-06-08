import { MovementType } from "@prisma/client";
import type { ProjectFundingMode } from "./types";

export interface ProjectKpis {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  movementCount: number;
  targetAmount: number;
  progress: number | null;
  executionProgress: number | null;
}

interface MovementLike {
  amount: number | { toNumber(): number };
  movementType: MovementType;
}

function computeFundraisingProgress(totalIncome: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0;
  return Math.min(100, Math.round((totalIncome / targetAmount) * 100));
}

function computeExecutionProgress(totalExpense: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0;
  return Math.min(100, Math.round((totalExpense / targetAmount) * 100));
}

export function computeProjectKpis(
  movements: MovementLike[],
  targetAmount: number,
  fundingMode: ProjectFundingMode = "FUNDRAISING"
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

  if (fundingMode === "EXECUTION") {
    return {
      totalIncome,
      totalExpense,
      balance,
      movementCount: movements.length,
      targetAmount,
      progress: null,
      executionProgress: computeExecutionProgress(totalExpense, targetAmount),
    };
  }

  return {
    totalIncome,
    totalExpense,
    balance,
    movementCount: movements.length,
    targetAmount,
    progress: computeFundraisingProgress(totalIncome, targetAmount),
    executionProgress: null,
  };
}
