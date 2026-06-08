import { endOfYear, parseISO, startOfYear } from "date-fns";
import { MovementType } from "@prisma/client";
import { buildCategoryBreakdown } from "./category-breakdown";
import { computeCategorizationQuality } from "./categorization-quality";
import { computeEventKpis } from "./event-stats";
import { computeFundBalance } from "./map-movement";
import { computeReportTotals } from "./report-filter";
import type { EventSummary, MovementRecord, ProjectSummary } from "./types";

export interface AssemblyEventRow {
  id: string;
  name: string;
  date: string;
  goal: number | null;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  goalProgress: number | null;
  movementCount: number;
}

export interface AssemblyProjectRow {
  id: string;
  name: string;
  targetAmount: number;
  totalIncome: number;
  progress: number;
  status: string;
  movementCount: number;
}

export interface AssemblyReportSnapshot {
  year: string;
  saldoTotal: number;
  saldoCajaChica: number;
  saldoFondoAhorro: number;
  yearRecords: MovementRecord[];
  periodTotals: ReturnType<typeof computeReportTotals>;
  categorizationQuality: ReturnType<typeof computeCategorizationQuality>;
  topExpenses: ReturnType<typeof buildCategoryBreakdown>;
  topIncomes: ReturnType<typeof buildCategoryBreakdown>;
  events: AssemblyEventRow[];
  projects: AssemblyProjectRow[];
}

export function filterRecordsByYear(records: MovementRecord[], year: string): MovementRecord[] {
  const yearStart = startOfYear(parseISO(`${year}-01-01`));
  const yearEnd = endOfYear(parseISO(`${year}-01-01`));

  return records.filter((record) => {
    const date = parseISO(record.date);
    return date >= yearStart && date <= yearEnd;
  });
}

function buildAssemblyEvents(
  yearRecords: MovementRecord[],
  eventSummaries: EventSummary[]
): AssemblyEventRow[] {
  const eventIdsInYear = new Set(
    yearRecords.filter((record) => record.eventId).map((record) => record.eventId as string)
  );

  return eventSummaries
    .filter((event) => eventIdsInYear.has(event.id))
    .map((event) => {
      const eventRecords = yearRecords.filter(
        (record) => record.eventId === event.id && record.transferId === null
      );
      const kpis = computeEventKpis(
        eventRecords.map((record) => ({
          amount: Math.abs(record.amount),
          movementType:
            record.type === "Ingreso" ? MovementType.INCOME : MovementType.EXPENSE,
        })),
        event.goal
      );

      return {
        id: event.id,
        name: event.name,
        date: event.date,
        goal: event.goal,
        totalIncome: kpis.totalIncome,
        totalExpense: kpis.totalExpense,
        profit: kpis.profit,
        goalProgress: kpis.goalProgress,
        movementCount: eventRecords.length,
      };
    })
    .sort((a, b) => b.profit - a.profit);
}

function buildAssemblyProjects(
  yearRecords: MovementRecord[],
  projectSummaries: ProjectSummary[]
): AssemblyProjectRow[] {
  const projectIdsInYear = new Set(
    yearRecords.filter((record) => record.projectId).map((record) => record.projectId as string)
  );

  return projectSummaries
    .filter((project) => projectIdsInYear.has(project.id))
    .map((project) => {
      const projectRecords = yearRecords.filter(
        (record) => record.projectId === project.id && record.transferId === null
      );
      const totalIncome = projectRecords
        .filter((record) => record.type === "Ingreso")
        .reduce((sum, record) => sum + Math.abs(record.amount), 0);
      const progress =
        project.targetAmount > 0
          ? Math.min(100, Math.round((totalIncome / project.targetAmount) * 100))
          : 0;

      return {
        id: project.id,
        name: project.name,
        targetAmount: project.targetAmount,
        totalIncome,
        progress,
        status: project.status,
        movementCount: projectRecords.length,
      };
    })
    .sort((a, b) => b.totalIncome - a.totalIncome);
}

export function buildAssemblySnapshot(
  allRecords: MovementRecord[],
  year: string,
  eventSummaries: EventSummary[],
  projectSummaries: ProjectSummary[]
): AssemblyReportSnapshot {
  const yearRecords = filterRecordsByYear(allRecords, year);
  const periodTotals = computeReportTotals(yearRecords);
  const operational = periodTotals.operational;

  const expenseBreakdown = buildCategoryBreakdown(
    operational.filter((record) => record.type === "Egreso")
  );
  const incomeBreakdown = buildCategoryBreakdown(
    operational.filter((record) => record.type === "Ingreso")
  );

  return {
    year,
    saldoTotal:
      computeFundBalance(allRecords, "caja_chica") +
      computeFundBalance(allRecords, "fondo_ahorro"),
    saldoCajaChica: computeFundBalance(allRecords, "caja_chica"),
    saldoFondoAhorro: computeFundBalance(allRecords, "fondo_ahorro"),
    yearRecords,
    periodTotals,
    categorizationQuality: computeCategorizationQuality(yearRecords),
    topExpenses: expenseBreakdown.slice(0, 8),
    topIncomes: incomeBreakdown.slice(0, 8),
    events: buildAssemblyEvents(yearRecords, eventSummaries),
    projects: buildAssemblyProjects(yearRecords, projectSummaries),
  };
}
