export const ORG_SLUG = "cgpa";

export const FUND_CODE_TO_TAB: Record<string, "caja_chica" | "fondo_ahorro"> = {
  CAJA_CHICA: "caja_chica",
  FONDO_AHORRO: "fondo_ahorro",
};

export const TAB_TO_FUND_CODE: Record<"caja_chica" | "fondo_ahorro", string> = {
  caja_chica: "CAJA_CHICA",
  fondo_ahorro: "FONDO_AHORRO",
};

export type FundTab = keyof typeof TAB_TO_FUND_CODE;

export interface MovementRecord {
  id: string;
  date: string;
  amount: number;
  type: "Ingreso" | "Egreso";
  description: string;
  status: "COMPLETED";
  tags: string;
  category: FundTab;
  categoryId: string | null;
  categoryName: string | null;
  categoryCode: string | null;
  fundName: string;
  transferId: string | null;
  eventId: string | null;
  eventName: string | null;
  projectId: string | null;
  projectName: string | null;
}

export interface CategoryOption {
  id: string;
  code: string;
  name: string;
  type: "INCOME" | "EXPENSE";
}

export interface FundOption {
  id: string;
  code: string;
  name: string;
  tab: FundTab;
}

export interface EventOption {
  id: string;
  name: string;
  date: string;
  goal: number | null;
}

export interface EventSummary {
  id: string;
  name: string;
  date: string;
  goal: number | null;
  description: string | null;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  movementCount: number;
  goalProgress: number | null;
}

export type ProjectStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface ProjectOption {
  id: string;
  name: string;
  targetAmount: number;
  status: ProjectStatus;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  targetAmount: number;
  status: ProjectStatus;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  movementCount: number;
  progress: number;
}
