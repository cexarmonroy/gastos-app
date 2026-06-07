import type { ProjectStatus } from "./types";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNED: "Planificado",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};
