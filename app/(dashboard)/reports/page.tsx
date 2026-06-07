"use client";

import { useState, useEffect, useMemo } from "react";
import { PieChart, Download, Calendar, FileText, BarChart3, TrendingUp, Tags } from "lucide-react";
import { fetchMovementsData, getAllCategoryOptions, logReportExport } from "@/app/actions/movements";
import { buildCategoryBreakdown } from "@/lib/finance/category-breakdown";
import type { CategoryOption } from "@/lib/finance/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { getBase64ImageFromUrl } from "@/lib/pdf-utils";

export default function ReportsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<"mensual" | "personalizado" | "completo">("mensual");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedFund, setSelectedFund] = useState<"todos" | "caja_chica" | "fondo_ahorro">("todos");
  const [selectedClassCategory, setSelectedClassCategory] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    Promise.all([fetchMovementsData(), getAllCategoryOptions()]).then(([data, cats]) => {
      setRecords(data.map((d) => ({ ...d, date: new Date(d.date) })));
      setCategories(cats);
      setIsLoading(false);
    });
  }, []);

  const getFilteredRecords = () => {
    let filtered = [...records];

    if (selectedFund !== "todos") {
      filtered = filtered.filter((r) => r.category === selectedFund);
    }

    if (selectedClassCategory) {
      filtered = filtered.filter((r) => r.categoryId === selectedClassCategory);
    }

    if (reportType === "mensual" && selectedMonth) {
      const monthStart = startOfMonth(new Date(selectedMonth + "-01"));
      const monthEnd = endOfMonth(new Date(selectedMonth + "-01"));
      filtered = filtered.filter((r) => {
        const recordDate = new Date(r.date);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });
    } else if (reportType === "personalizado" && startDate && endDate) {
      filtered = filtered.filter((r) => {
        const recordDate = format(new Date(r.date), "yyyy-MM-dd");
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    return filtered;
  };

  const filteredRecords = getFilteredRecords();
  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(filteredRecords),
    [filteredRecords]
  );

  const totalIngresos = filteredRecords
    .filter((r) => r.type.toLowerCase().includes("ingreso"))
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);

  const totalEgresos = filteredRecords
    .filter((r) => r.type.toLowerCase().includes("egreso"))
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);

  const saldo = totalIngresos - totalEgresos;

  const generateReport = async () => {
    setIsGenerating(true);
    const doc = new jsPDF();
    let yPosition = 15;

    try {
      const logoBase64 = await getBase64ImageFromUrl("/logo-cgpa.png");
      doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
      yPosition = 20;
    } catch {
      // sin logo
    }

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte Financiero", 40, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    if (reportType === "mensual") {
      doc.text(`Período: ${format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: es })}`, 40, yPosition);
    } else if (reportType === "personalizado") {
      doc.text(
        `Período: ${format(new Date(startDate), "dd/MM/yyyy", { locale: es })} - ${format(new Date(endDate), "dd/MM/yyyy", { locale: es })}`,
        40,
        yPosition
      );
    } else {
      doc.text("Período: Todos los registros", 40, yPosition);
    }
    yPosition += 5;

    if (selectedFund !== "todos") {
      doc.text(`Fondo: ${selectedFund === "caja_chica" ? "Caja Chica" : "Fondo de Ahorro"}`, 40, yPosition);
      yPosition += 5;
    }

    if (selectedClassCategory) {
      const catName = categories.find((c) => c.id === selectedClassCategory)?.name ?? "";
      doc.text(`Categoría: ${catName}`, 40, yPosition);
      yPosition += 5;
    }

    doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 40, yPosition);
    yPosition += 12;

    doc.setFont("helvetica", "bold");
    doc.text("Resumen Ejecutivo", 14, yPosition);
    yPosition += 8;
    doc.setFont("helvetica", "normal");
    doc.text(`Total Ingresos: $${totalIngresos.toLocaleString("es-CL")}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Egresos: $${totalEgresos.toLocaleString("es-CL")}`, 20, yPosition);
    yPosition += 7;
    doc.setFont("helvetica", "bold");
    doc.text(`Saldo: $${saldo.toLocaleString("es-CL")}`, 20, yPosition);
    yPosition += 12;

    if (categoryBreakdown.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Desglose por Categoría", 14, yPosition);
      yPosition += 4;

      autoTable(doc, {
        head: [["Categoría", "Tipo", "Movimientos", "Total"]],
        body: categoryBreakdown.map((item) => [
          item.categoryName,
          item.type,
          item.count.toString(),
          `$${item.total.toLocaleString("es-CL")}`,
        ]),
        startY: yPosition,
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241] },
        styles: { fontSize: 8 },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    if (filteredRecords.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Detalle de Registros", 14, yPosition);

      autoTable(doc, {
        head: [["Fecha", "Descripción", "Categoría", "Tipo", "Monto"]],
        body: filteredRecords.map((r) => [
          format(new Date(r.date), "dd/MM/yyyy", { locale: es }),
          r.description || "Sin descripción",
          r.categoryName || "Sin categoría",
          r.type,
          `$${Math.abs(r.amount).toLocaleString("es-CL")}`,
        ]),
        startY: yPosition + 4,
        theme: "grid",
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
        styles: { fontSize: 7, cellPadding: 2 },
      });
    }

    const fileName =
      reportType === "mensual"
        ? `Reporte_${format(new Date(selectedMonth + "-01"), "MMMM_yyyy", { locale: es })}.pdf`
        : reportType === "personalizado"
        ? `Reporte_${format(new Date(startDate), "dd-MM-yyyy")}_${format(new Date(endDate), "dd-MM-yyyy")}.pdf`
        : `Reporte_Completo_${format(new Date(), "dd-MM-yyyy")}.pdf`;

    doc.save(fileName);

    await logReportExport({
      reportType,
      selectedFund,
      selectedClassCategory,
      recordCount: filteredRecords.length,
      totalIngresos,
      totalEgresos,
      fileName,
    });

    setIsGenerating(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-white/60 text-sm md:text-base">
            Reportes por fondo, categoría y desglose analítico.
          </p>
        </div>
        <button
          onClick={generateReport}
          disabled={isGenerating || filteredRecords.length === 0}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
        >
          <Download className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
          {isGenerating ? "Generando..." : "Generar Reporte PDF"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Tipo de Reporte
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {(["mensual", "personalizado", "completo"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`p-3 md:p-4 rounded-lg border transition-all ${
                    reportType === type
                      ? "bg-primary/20 border-primary text-white"
                      : "bg-white/5 border-white/10 text-white/60 hover:border-primary/50"
                  }`}
                >
                  {type === "mensual" && <Calendar className="w-6 h-6 mb-2 mx-auto" />}
                  {type === "personalizado" && <BarChart3 className="w-6 h-6 mb-2 mx-auto" />}
                  {type === "completo" && <PieChart className="w-6 h-6 mb-2 mx-auto" />}
                  <p className="font-medium text-sm capitalize">{type === "completo" ? "Completo" : type === "mensual" ? "Mensual" : "Personalizado"}</p>
                </button>
              ))}
            </div>
          </div>

          {reportType === "mensual" && (
            <div className="glass-panel p-4 md:p-6">
              <h3 className="font-semibold mb-3">Seleccionar Mes</h3>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input-premium w-full"
              />
            </div>
          )}

          {reportType === "personalizado" && (
            <div className="glass-panel p-4 md:p-6">
              <h3 className="font-semibold mb-3">Rango de Fechas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-premium w-full" />
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-premium w-full" />
              </div>
            </div>
          )}

          <div className="glass-panel p-4 md:p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-3">Fondo</h3>
              <div className="flex flex-wrap gap-2">
                {(["todos", "caja_chica", "fondo_ahorro"] as const).map((fund) => (
                  <button
                    key={fund}
                    onClick={() => setSelectedFund(fund)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      selectedFund === fund ? "bg-primary text-white" : "bg-white/5 text-white/60"
                    }`}
                  >
                    {fund === "todos" ? "Todos" : fund === "caja_chica" ? "Caja Chica" : "Fondo de Ahorro"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Tags className="w-4 h-4 text-accent" />
                Categoría contable
              </h3>
              <select
                value={selectedClassCategory}
                onChange={(e) => setSelectedClassCategory(e.target.value)}
                className="select-premium w-full"
              >
                <option value="">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.type === "INCOME" ? "Ingreso" : "Gasto"})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-panel p-4 md:p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Vista Previa
            </h3>
            {isLoading ? (
              <p className="text-white/50 text-sm">Cargando...</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-white/60 text-sm">Ingresos</p>
                  <p className="text-xl font-bold text-success">${totalIngresos.toLocaleString("es-CL")}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Egresos</p>
                  <p className="text-xl font-bold text-danger">${totalEgresos.toLocaleString("es-CL")}</p>
                </div>
                <div className="pt-3 border-t border-white/10">
                  <p className="text-white/60 text-sm">Saldo</p>
                  <p className={`text-xl font-bold ${saldo >= 0 ? "text-success" : "text-danger"}`}>
                    ${saldo.toLocaleString("es-CL")}
                  </p>
                </div>
                <p className="text-white/50 text-sm pt-2">{filteredRecords.length} registros</p>
              </div>
            )}
          </div>

          {!isLoading && categoryBreakdown.length > 0 && (
            <div className="glass-panel p-4 md:p-6">
              <h3 className="font-semibold mb-3 text-sm">Por categoría</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {categoryBreakdown.slice(0, 8).map((item) => (
                  <div key={`${item.categoryId}-${item.type}`} className="flex justify-between text-xs gap-2">
                    <span className="text-white/70 truncate">{item.categoryName}</span>
                    <span className={`font-mono flex-shrink-0 ${item.type === "Ingreso" ? "text-success" : "text-danger"}`}>
                      ${item.total.toLocaleString("es-CL")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
