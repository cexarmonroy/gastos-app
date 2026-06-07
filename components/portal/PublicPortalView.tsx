"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, ExternalLink } from "lucide-react";
import { getBase64ImageFromUrl } from "@/lib/pdf-utils";

type Summary = NonNullable<Awaited<ReturnType<typeof import("@/app/actions/public-portal").getPublicTreasurySummary>>>;
type Project = Awaited<ReturnType<typeof import("@/app/actions/public-portal").getPublicProjectsSummary>>[number];

interface PublicPortalViewProps {
  summary: Summary;
  projects: Project[];
}

export function PublicPortalView({ summary, projects }: PublicPortalViewProps) {
  const [isExporting, setIsExporting] = useState(false);

  const formatMoney = (value: number) => `$${value.toLocaleString("es-CL")}`;

  const lastUpdateLabel = useMemo(() => {
    if (!summary.lastMovementDate) return "Sin movimientos";
    return format(parseISO(summary.lastMovementDate), "dd MMM yyyy", { locale: es });
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
          format(parseISO(movement.date), "dd/MM/yyyy"),
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
    <div className="min-h-screen bg-[#0b0d17] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 md:mb-10">
          <p className="text-primary text-sm font-semibold mb-2">Portal de transparencia</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{summary.organizationName}</h1>
          <p className="text-white/60">
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
            <a href="/" className="btn-secondary flex items-center gap-2">
              Acceso tesoreros
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {summary.fundBalances.map((fund) => (
            <div key={fund.name} className="glass-panel p-5">
              <p className="text-white/50 text-sm mb-1">{fund.name}</p>
              <p className="text-2xl font-bold">{formatMoney(fund.balance)}</p>
            </div>
          ))}
          <div className="glass-panel p-5 border border-primary/20">
            <p className="text-white/50 text-sm mb-1">Saldo total</p>
            <p className="text-2xl font-bold text-primary">{formatMoney(summary.totalSaldo)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="glass-panel p-5">
            <p className="text-white/50 text-sm mb-1">Total ingresos</p>
            <p className="text-2xl font-bold text-success">{formatMoney(summary.totalIngresos)}</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-white/50 text-sm mb-1">Total egresos</p>
            <p className="text-2xl font-bold text-danger">{formatMoney(summary.totalEgresos)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="glass-panel p-5">
            <h2 className="font-semibold mb-4">Top ingresos por categoría</h2>
            <div className="space-y-2">
              {summary.incomeBreakdown.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos</p>
              ) : (
                summary.incomeBreakdown.map((item) => (
                  <div key={item.categoryId ?? item.categoryName} className="flex justify-between text-sm">
                    <span className="text-white/70">{item.categoryName}</span>
                    <span className="text-success font-mono">{formatMoney(item.total)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="glass-panel p-5">
            <h2 className="font-semibold mb-4">Top gastos por categoría</h2>
            <div className="space-y-2">
              {summary.expenseBreakdown.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos</p>
              ) : (
                summary.expenseBreakdown.map((item) => (
                  <div key={item.categoryId ?? item.categoryName} className="flex justify-between text-sm">
                    <span className="text-white/70">{item.categoryName}</span>
                    <span className="text-danger font-mono">{formatMoney(item.total)}</span>
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
              {projects.map((project) => (
                <div key={project.name} className="border border-white/5 rounded-xl p-4">
                  <div className="flex flex-wrap justify-between gap-2 mb-2">
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-white/50">Meta: {formatMoney(project.targetAmount)}</p>
                  </div>
                  <div className="w-full bg-black/40 rounded-full h-2 mb-2">
                    <div
                      className="bg-gradient-to-r from-primary to-accent h-2 rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/50">
                    Avance {project.progress}% · Asignado {formatMoney(project.totalIncome)} · Gastado{" "}
                    {formatMoney(project.totalExpense)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass-panel overflow-hidden">
          <div className="p-5 border-b border-white/5">
            <h2 className="font-semibold">Últimos movimientos</h2>
            <p className="text-sm text-white/50">{summary.movementCount} registros en total</p>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-white/5 text-white/60">
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
                  <tr key={`${movement.date}-${index}`} className="border-t border-white/5">
                    <td className="p-3 whitespace-nowrap">
                      {format(parseISO(movement.date), "dd/MM/yyyy")}
                    </td>
                    <td className="p-3">{movement.description || "Sin descripción"}</td>
                    <td className="p-3">{movement.fundName}</td>
                    <td className="p-3">{movement.categoryName ?? "Sin categoría"}</td>
                    <td
                      className={`p-3 text-right font-mono ${
                        movement.type === "Ingreso" ? "text-success" : "text-danger"
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

        <p className="text-center text-xs text-white/30 mt-8">
          Datos de solo lectura · Actualizado al consultar · {format(parseISO(summary.generatedAt), "dd/MM/yyyy HH:mm")}
        </p>
      </div>
    </div>
  );
}
