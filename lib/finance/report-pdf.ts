import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { CategoryBreakdownItem } from "./category-breakdown";
import type { AssemblyReportSnapshot } from "./assembly-report";
import type { FundBalanceSnapshot } from "./report-fund-balance";
import { kpisFromMovementRecords } from "./event-stats";
import type { MovementRecord } from "./types";
import { toPdfSafeText } from "@/lib/pdf-utils";

type ReportTotals = {
  totalIngresos: number;
  totalEgresos: number;
  resultado: number;
  transferCount: number;
  transferMovementCount: number;
  operational: MovementRecord[];
  transfers: MovementRecord[];
};

export interface StandardReportPdfContext {
  periodLabel: string;
  fundLabel?: string;
  categoryLabel?: string;
  eventLabel?: string;
  projectLabel?: string;
  eventGoal?: {
    name: string;
    goal: number | null;
    totalIncome: number;
    totalExpense: number;
    profit: number;
    goalProgress: number | null;
  };
  reportTotals: ReportTotals;
  categoryBreakdown: CategoryBreakdownItem[];
  fundBalance?: FundBalanceSnapshot;
}

function getTableEndY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

async function addLogo(doc: jsPDF): Promise<number> {
  try {
    const { getBase64ImageFromUrl } = await import("@/lib/pdf-utils");
    const logoBase64 = await getBase64ImageFromUrl("/logo-cgpa.png");
    doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
    return 20;
  } catch {
    return 15;
  }
}

function addSummarySection(doc: jsPDF, yPosition: number, totals: ReportTotals): number {
  doc.setFont("helvetica", "bold");
  doc.text("Resumen del periodo (sin transferencias)", 14, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`Total Ingresos: $${totals.totalIngresos.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Total Egresos: $${totals.totalEgresos.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 7;
  doc.setFont("helvetica", "bold");
  doc.text(`Resultado del periodo: $${totals.resultado.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 7;

  if (totals.transferCount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Transferencias internas: ${totals.transferCount} operacion(es) (${totals.transferMovementCount} movimientos), excluidas del resultado.`,
      20,
      yPosition
    );
    doc.setFontSize(10);
    yPosition += 10;
  } else {
    yPosition += 5;
  }

  return yPosition;
}

function addEventGoalSection(
  doc: jsPDF,
  yPosition: number,
  eventGoal: NonNullable<StandardReportPdfContext["eventGoal"]>
): number {
  doc.setFont("helvetica", "bold");
  doc.text("Actividad seleccionada", 14, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nombre: ${toPdfSafeText(eventGoal.name)}`, 20, yPosition);
  yPosition += 6;
  if (eventGoal.goal != null) {
    doc.text(`Meta: $${eventGoal.goal.toLocaleString("es-CL")}`, 20, yPosition);
    yPosition += 6;
    if (eventGoal.goalProgress != null) {
      doc.text(`Avance meta (ingresos): ${eventGoal.goalProgress}%`, 20, yPosition);
      yPosition += 6;
    }
  }
  doc.text(`Ingresos: $${eventGoal.totalIncome.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Gastos: $${eventGoal.totalExpense.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Ganancia: $${eventGoal.profit.toLocaleString("es-CL")}`, 20, yPosition);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return yPosition + 10;
}

function addFundBalanceSection(doc: jsPDF, yPosition: number, snapshot: FundBalanceSnapshot): number {
  doc.setFont("helvetica", "bold");
  doc.text("Posicion del fondo en el periodo", 14, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Fondo: ${toPdfSafeText(snapshot.fundLabel)}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Saldo inicial: $${snapshot.saldoInicial.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Saldo final: $${snapshot.saldoFinal.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Cambio de saldo: $${snapshot.cambioSaldo.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");

  if (snapshot.cajaChica && snapshot.fondoAhorro) {
    doc.text(
      `Caja Chica: $${snapshot.cajaChica.saldoInicial.toLocaleString("es-CL")} -> $${snapshot.cajaChica.saldoFinal.toLocaleString("es-CL")}`,
      20,
      yPosition
    );
    yPosition += 6;
    doc.text(
      `Fondo de Ahorro: $${snapshot.fondoAhorro.saldoInicial.toLocaleString("es-CL")} -> $${snapshot.fondoAhorro.saldoFinal.toLocaleString("es-CL")}`,
      20,
      yPosition
    );
    yPosition += 6;
  }

  doc.setFontSize(10);
  return yPosition + 6;
}

function addCategoryTable(
  doc: jsPDF,
  yPosition: number,
  title: string,
  items: CategoryBreakdownItem[]
): number {
  if (items.length === 0) return yPosition;

  doc.setFont("helvetica", "bold");
  doc.text(title, 14, yPosition);

  autoTable(doc, {
    head: [["Categoria", "Tipo", "Movimientos", "Total"]],
    body: items.map((item) => [
      toPdfSafeText(item.categoryName),
      toPdfSafeText(item.type),
      item.count.toString(),
      `$${item.total.toLocaleString("es-CL")}`,
    ]),
    startY: yPosition + 4,
    theme: "grid",
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 8 },
  });

  return getTableEndY(doc) + 10;
}

function addDetailTables(doc: jsPDF, yPosition: number, totals: ReportTotals): number {
  const addTable = (
    title: string,
    rows: MovementRecord[],
    typeLabel: (record: MovementRecord) => string
  ) => {
    if (rows.length === 0) return;

    doc.setFont("helvetica", "bold");
    doc.text(title, 14, yPosition);

    autoTable(doc, {
      head: [["Fecha", "Descripcion", "Categoria", "Actividad", "Tipo", "Monto"]],
      body: rows.map((record) => [
        format(parseISO(record.date), "dd/MM/yyyy", { locale: es }),
        toPdfSafeText(record.description, "Sin descripcion"),
        toPdfSafeText(record.categoryName, "-"),
        toPdfSafeText(record.eventName, "-"),
        toPdfSafeText(typeLabel(record)),
        `$${Math.abs(record.amount).toLocaleString("es-CL")}`,
      ]),
      startY: yPosition + 4,
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      styles: { fontSize: 7, cellPadding: 2 },
    });

    yPosition = getTableEndY(doc) + 10;
  };

  addTable("Detalle de movimientos", totals.operational, (record) => record.type);
  addTable("Transferencias internas", totals.transfers, () => "Transferencia");
  return yPosition;
}

export interface ActivityReportPdfContext {
  activityName: string;
  periodLabel: string;
  fundLabel?: string;
  eventGoal: NonNullable<StandardReportPdfContext["eventGoal"]>;
  roiPercent: number | null;
  reportTotals: ReportTotals;
  categoryBreakdown: CategoryBreakdownItem[];
  fundBalance?: FundBalanceSnapshot;
}

export async function generateActivityReportPdf(context: ActivityReportPdfContext): Promise<jsPDF> {
  const doc = new jsPDF();
  let yPosition = await addLogo(doc);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Reporte de Actividad", 40, yPosition);
  yPosition += 8;

  doc.setFontSize(12);
  doc.text(toPdfSafeText(context.activityName), 40, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periodo: ${toPdfSafeText(context.periodLabel)}`, 40, yPosition);
  yPosition += 5;

  if (context.fundLabel) {
    doc.text(`Fondo: ${toPdfSafeText(context.fundLabel)}`, 40, yPosition);
    yPosition += 5;
  }

  doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 40, yPosition);
  yPosition += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Resultado de la actividad", 14, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`Ingresos: $${context.eventGoal.totalIncome.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Gastos: $${context.eventGoal.totalExpense.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Ganancia: $${context.eventGoal.profit.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.setFont("helvetica", "normal");
  if (context.roiPercent != null) {
    doc.text(`ROI (ganancia / gastos): ${context.roiPercent}%`, 20, yPosition);
    yPosition += 6;
  }
  yPosition += 6;

  if (context.fundBalance) {
    yPosition = addFundBalanceSection(doc, yPosition, context.fundBalance);
  }

  yPosition = addEventGoalSection(doc, yPosition, context.eventGoal);

  if (context.reportTotals.transferCount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Transferencias internas: ${context.reportTotals.transferCount} operacion(es), excluidas del resultado.`,
      20,
      yPosition
    );
    doc.setFontSize(10);
    yPosition += 10;
  }

  yPosition = addCategoryTable(doc, yPosition, "Desglose por Categoria", context.categoryBreakdown);
  addDetailTables(doc, yPosition, context.reportTotals);

  return doc;
}

export async function generateStandardReportPdf(context: StandardReportPdfContext): Promise<jsPDF> {
  const doc = new jsPDF();
  let yPosition = await addLogo(doc);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Reporte Financiero", 40, yPosition);
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periodo: ${toPdfSafeText(context.periodLabel)}`, 40, yPosition);
  yPosition += 5;

  if (context.fundLabel) {
    doc.text(`Fondo: ${toPdfSafeText(context.fundLabel)}`, 40, yPosition);
    yPosition += 5;
  }
  if (context.categoryLabel) {
    doc.text(`Categoria: ${toPdfSafeText(context.categoryLabel)}`, 40, yPosition);
    yPosition += 5;
  }
  if (context.eventLabel) {
    doc.text(`Actividad: ${toPdfSafeText(context.eventLabel)}`, 40, yPosition);
    yPosition += 5;
  }
  if (context.projectLabel) {
    doc.text(`Proyecto: ${toPdfSafeText(context.projectLabel)}`, 40, yPosition);
    yPosition += 5;
  }

  doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 40, yPosition);
  yPosition += 12;

  yPosition = addSummarySection(doc, yPosition, context.reportTotals);

  if (context.fundBalance) {
    yPosition = addFundBalanceSection(doc, yPosition, context.fundBalance);
  }

  if (context.eventGoal) {
    yPosition = addEventGoalSection(doc, yPosition, context.eventGoal);
  }

  yPosition = addCategoryTable(doc, yPosition, "Desglose por Categoria", context.categoryBreakdown);
  addDetailTables(doc, yPosition, context.reportTotals);

  return doc;
}

export async function generateAssemblyReportPdf(snapshot: AssemblyReportSnapshot): Promise<jsPDF> {
  const doc = new jsPDF();
  let yPosition = await addLogo(doc);

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Rendicion de Cuentas CGPA", 40, yPosition);
  yPosition += 7;
  doc.setFontSize(12);
  doc.text(`Asamblea - Ano ${snapshot.year}`, 40, yPosition);
  yPosition += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 40, yPosition);
  yPosition += 12;

  doc.setFont("helvetica", "bold");
  doc.text("Posicion de tesoreria", 14, yPosition);
  yPosition += 8;
  doc.setFont("helvetica", "normal");
  doc.text(`Saldo total: $${snapshot.saldoTotal.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Caja Chica: $${snapshot.saldoCajaChica.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Fondo de Ahorro: $${snapshot.saldoFondoAhorro.toLocaleString("es-CL")}`, 20, yPosition);
  yPosition += 12;

  yPosition = addSummarySection(doc, yPosition, snapshot.periodTotals);

  if (snapshot.events.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Actividades del ano", 14, yPosition);
    autoTable(doc, {
      head: [["Actividad", "Meta", "Ingresos", "Gastos", "Ganancia", "Avance"]],
      body: snapshot.events.map((event) => [
        toPdfSafeText(event.name),
        event.goal != null ? `$${event.goal.toLocaleString("es-CL")}` : "-",
        `$${event.totalIncome.toLocaleString("es-CL")}`,
        `$${event.totalExpense.toLocaleString("es-CL")}`,
        `$${event.profit.toLocaleString("es-CL")}`,
        event.goalProgress != null ? `${event.goalProgress}%` : "-",
      ]),
      startY: yPosition + 4,
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 7, cellPadding: 2 },
    });
    yPosition = getTableEndY(doc) + 10;
  }

  if (snapshot.projects.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Proyectos del ano", 14, yPosition);
    autoTable(doc, {
      head: [["Proyecto", "Tipo", "Meta/Presup.", "Monto ano", "Indicador"]],
      body: snapshot.projects.map((project) => [
        toPdfSafeText(project.name),
        project.fundingMode === "EXECUTION" ? "Ejecucion" : "Recaudacion",
        `$${project.targetAmount.toLocaleString("es-CL")}`,
        `$${(project.fundingMode === "EXECUTION"
          ? project.totalExpense
          : project.totalIncome
        ).toLocaleString("es-CL")}`,
        project.fundingMode === "EXECUTION"
          ? `${project.executionProgress ?? 0}% ejecutado`
          : `${project.progress ?? 0}% avance`,
      ]),
      startY: yPosition + 4,
      theme: "grid",
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 7, cellPadding: 2 },
    });
    yPosition = getTableEndY(doc) + 10;
  }

  yPosition = addCategoryTable(doc, yPosition, "Top gastos del ano", snapshot.topExpenses);
  addCategoryTable(doc, yPosition, "Top ingresos del ano", snapshot.topIncomes);

  return doc;
}

export function buildEventGoalFromRecords(
  eventName: string,
  goal: number | null,
  operationalRecords: MovementRecord[]
) {
  const kpis = kpisFromMovementRecords(operationalRecords, goal);
  return {
    name: eventName,
    goal,
    totalIncome: kpis.totalIncome,
    totalExpense: kpis.totalExpense,
    profit: kpis.profit,
    goalProgress: kpis.goalProgress,
  };
}
