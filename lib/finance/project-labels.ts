import type { ProjectFundingMode, ProjectStatus } from "./types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Planificado",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export const PROJECT_FUNDING_MODE_LABELS: Record<ProjectFundingMode, string> = {
  FUNDRAISING: "Con recaudación",
  EXECUTION: "Ejecución",
};

export function isFundraisingProject(mode: ProjectFundingMode): boolean {
  return mode === "FUNDRAISING";
}
