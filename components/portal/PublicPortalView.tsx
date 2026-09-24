"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { formatCalendarDate } from "@/lib/date-only";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { getBase64ImageFromUrl } from "@/lib/pdf-utils";
import { formatCLP as formatMoney } from "@/lib/format";

type Summary = NonNullable<Awaited<ReturnType<typeof import("@/app/actions/public-portal").getPublicTreasurySummary>>>;
type Project = Awaited<ReturnType<typeof import("@/app/actions/public-portal").getPublicProjectsSummary>>[number];

interface PublicPortalViewProps {
  summary: Summary;
  projects: Project[];
}

export function PublicPortalView({ summary, projects }: PublicPortalViewProps) {
  const [isExporting, setIsExporting] = useState(false);

  const lastUpdateLabel = useMemo(() => {
    if (!summary.lastMovementDate) return "Sin movimientos";
    return formatCalendarDate(summary.lastMovementDate, "dd MMM yyyy", { locale: es });
  }, [summary.lastMovementDate]);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();

      try {
        const logoBase64 = await getBase64ImageFromUrl("/logo-cgpa.png");
        doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
      } catch {
        // logo opcional
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Reporte Público de Tesorería", 40, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(summary.organizationName, 40, 24);
      doc.text(`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 40, 30);
      doc.text(`Último movimiento: ${lastUpdateLabel}`, 40, 36);

      autoTable(doc, {
        startY: 44,
        head: [["Concepto", "Monto"]],
        body: [
          ...summary.fundBalances.map((fund) => [fund.name, formatMoney(fund.balance)]),
          ["Saldo total", formatMoney(summary.totalSaldo)],
          ["Total ingresos", formatMoney(summary.totalIngresos)],
          ["Total egresos", formatMoney(summary.totalEgresos)],
        ],
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241] },
      });

      const startRecent = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90;

      autoTable(doc, {
        startY: startRecent + 8,
        head: [["Fecha", "Descripción", "Fondo", "Tipo", "Monto"]],
        body: summary.recentMovements.map((movement) => [
          formatCalendarDate(movement.date, "dd/MM/yyyy"),
          movement.description,
          movement.fundName,
          movement.type,
          formatMoney(movement.amount),
        ]),
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
      });

      doc.save(`Tesoreria_Publica_${format(new Date(), "dd-MM-yyyy")}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-10">
          <p className="text-primary text-sm font-semibold mb-2">Portal de transparencia</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{summary.organizationName}</h1>
          <p className="text-muted">
            Resumen financiero de solo lectura · Último movimiento: {lastUpdateLabel}
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Generando..." : "Descargar PDF"}
            </button>
            <Link href="/" className="btn-secondary flex items-center gap-2">
              Acceso tesoreros
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {summary.fundBalances.map((fund) => (
            <div key={fund.name} className="glass-panel p-5">
              <p className="text-muted text-sm mb-1">{fund.name}</p>
              <p className="text-2xl font-bold">{formatMoney(fund.balance)}</p>
            </div>
          ))}
          <div className="glass-panel p-5 border border-primary/20">
            <p className="text-muted text-sm mb-1">Saldo total</p>
            <p className="text-2xl font-bold text-primary">{formatMoney(summary.totalSaldo)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="glass-panel p-5">
            <p className="text-muted text-sm mb-1">Total ingresos</p>
            <p className="text-2xl font-bold text-income">{formatMoney(summary.totalIngresos)}</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-muted text-sm mb-1">Total egresos</p>
            <p className="text-2xl font-bold text-expense">{formatMoney(summary.totalEgresos)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="glass-panel p-5">
            <h2 className="font-semibold mb-4">Top ingresos por categoría</h2>
            <div className="space-y-2">
              {summary.incomeBreakdown.length === 0 ? (
                <p className="text-muted text-sm">Sin datos</p>
              ) : (
                summary.incomeBreakdown.map((item) => (
                  <div key={item.categoryId ?? item.categoryName} className="flex justify-between text-sm">
                    <span className="text-muted">{item.categoryName}</span>
                    <span className="text-income tabular-nums">{formatMoney(item.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="glass-panel p-5">
            <h2 className="font-semibold mb-4">Top gastos por categoría</h2>
            <div className="space-y-2">
              {summary.expenseBreakdown.length === 0 ? (
                <p className="text-muted text-sm">Sin datos</p>
              ) : (
                summary.expenseBreakdown.map((item) => (
                  <div key={item.categoryId ?? item.categoryName} className="flex justify-between text-sm">
                    <span className="text-muted">{item.categoryName}</span>
                    <span className="text-expense tabular-nums">{formatMoney(item.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {projects.length > 0 && (
          <div className="glass-panel p-5 mb-8">
            <h2 className="font-semibold mb-4">Proyectos del Fondo de Ahorro</h2>
            <div className="space-y-4">
              {projects.map((project) => {
                const isExecution = project.fundingMode === "EXECUTION";
                const barWidth = isExecution
                  ? (project.executionProgress ?? 0)
                  : (project.progress ?? 0);
                return (
                  <div key={project.name} className="border border-border rounded-xl p-4">
                    <div className="flex flex-wrap justify-between gap-2 mb-2">
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted">
                        {isExecution ? "Presupuesto" : "Meta"}: {formatMoney(project.targetAmount)}
                      </p>
                    </div>
                    <div className="w-full bg-border rounded-full h-2 mb-2">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted">
                      {isExecution
                        ? `Ejecutado ${project.executionProgress ?? 0}% · Gastado ${formatMoney(project.totalExpense)}`
                        : `Avance ${project.progress ?? 0}% · Asignado ${formatMoney(project.totalIncome)} · Gastado ${formatMoney(project.totalExpense)}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="glass-panel overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold">Últimos movimientos</h2>
            <p className="text-sm text-muted">{summary.movementCount} registros en total</p>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="table-head text-muted">
                <tr>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Descripción</th>
                  <th className="text-left p-3">Fondo</th>
                  <th className="text-left p-3">Categoría</th>
                  <th className="text-right p-3">Monto</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentMovements.map((movement, index) => (
                  <tr key={`${movement.date}-${index}`} className="border-t border-border">
                    <td className="p-3 whitespace-nowrap">
                      {formatCalendarDate(movement.date, "dd/MM/yyyy")}
                    </td>
                    <td className="p-3">{movement.description || "Sin descripción"}</td>
                    <td className="p-3">{movement.fundName}</td>
                    <td className="p-3">{movement.categoryName ?? "Sin categoría"}</td>
                    <td
                      className={`p-3 text-right tabular-nums ${
                        movement.type === "Ingreso" ? "text-income" : "text-expense"
                      }`}
                    >
                      {movement.type === "Ingreso" ? "+" : "-"}
                      {formatMoney(movement.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-8">
          Datos de solo lectura · Actualizado al consultar · {format(parseISO(summary.generatedAt), "dd/MM/yyyy HH:mm")}
        </p>
      </div>
    </div>
  );
}
