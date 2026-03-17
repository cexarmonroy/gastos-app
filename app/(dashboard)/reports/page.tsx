"use client";

import { useState, useEffect } from "react";
import { PieChart, Download, Calendar, FileText, BarChart3, TrendingUp } from "lucide-react";
import { fetchRecordsData } from "@/app/actions/sheets";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { getBase64ImageFromUrl } from "@/lib/pdf-utils";

export default function ReportsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<"mensual" | "personalizado" | "completo">("mensual");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<"todos" | "caja_chica" | "fondo_ahorro">("todos");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchRecordsData().then(data => {
      const parsed = data.map(d => ({ ...d, date: new Date(d.date) }));
      setRecords(parsed);
      setIsLoading(false);
    });
  }, []);

  const getFilteredRecords = () => {
    let filtered = [...records];

    // Filtrar por categoría
    if (selectedCategory !== "todos") {
      filtered = filtered.filter(r => r.category === selectedCategory);
    }

    // Filtrar por fecha según el tipo de reporte
    if (reportType === "mensual" && selectedMonth) {
      const monthStart = startOfMonth(new Date(selectedMonth + "-01"));
      const monthEnd = endOfMonth(new Date(selectedMonth + "-01"));
      filtered = filtered.filter(r => {
        const recordDate = new Date(r.date);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });
    } else if (reportType === "personalizado" && startDate && endDate) {
      filtered = filtered.filter(r => {
        const recordDate = format(new Date(r.date), "yyyy-MM-dd");
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    return filtered;
  };

  const generateReport = async () => {
    setIsGenerating(true);
    const filteredRecords = getFilteredRecords();
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 15;

    // Agregar Logo
    try {
      const logoBase64 = await getBase64ImageFromUrl("/logo-cgpa.png");
      doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
      yPosition = 20;
    } catch (error) {
      console.error("Could not load logo for PDF", error);
    }

    // Título del reporte - Desplazado si hay logo
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Reporte Financiero", 40, yPosition);
    yPosition += 8;

    // Información del reporte
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let reportInfo = "";
    if (reportType === "mensual") {
      reportInfo = `Período: ${format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: es })}`;
    } else if (reportType === "personalizado") {
      reportInfo = `Período: ${format(new Date(startDate), "dd/MM/yyyy", { locale: es })} - ${format(new Date(endDate), "dd/MM/yyyy", { locale: es })}`;
    } else {
      reportInfo = "Período: Todos los registros";
    }
    doc.text(reportInfo, 40, yPosition);
    yPosition += 5;

    if (selectedCategory !== "todos") {
      const categoryName = selectedCategory === "caja_chica" ? "Caja Chica" : "Fondo de Ahorro";
      doc.text(`Categoría: ${categoryName}`, 40, yPosition);
      yPosition += 5;
    }

    doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, 40, yPosition);
    yPosition += 15;

    // Resumen de estadísticas
    const totalIngresos = filteredRecords
      .filter(r => r.type.toLowerCase().includes("ingreso"))
      .reduce((acc, r) => acc + Math.abs(r.amount), 0);
    
    const totalEgresos = filteredRecords
      .filter(r => r.type.toLowerCase().includes("egreso"))
      .reduce((acc, r) => acc + Math.abs(r.amount), 0);

    const saldo = totalIngresos - totalEgresos;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen Ejecutivo", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Ingresos: $${totalIngresos.toLocaleString('es-CL')}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Egresos: $${totalEgresos.toLocaleString('es-CL')}`, 20, yPosition);
    yPosition += 7;
    doc.setFont("helvetica", "bold");
    doc.text(`Saldo: $${saldo.toLocaleString('es-CL')}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total de Registros: ${filteredRecords.length}`, 20, yPosition);
    yPosition += 12;

    // Tabla de registros
    if (filteredRecords.length > 0) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Detalle de Registros", 14, yPosition);
      yPosition += 5;

      const tableColumn = ["Fecha", "Descripción", "Tipo", "Monto"];
      const tableRows = filteredRecords.map(r => [
        format(new Date(r.date), "dd/MM/yyyy", { locale: es }),
        r.description || "Sin descripción",
        r.type,
        `$${Math.abs(r.amount).toLocaleString('es-CL')}`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: yPosition,
        theme: 'grid',
        headStyles: { 
          fillColor: [99, 102, 241],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 8,
          cellPadding: 2
        },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 70 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40, halign: 'right' }
        }
      });
    }

    // Guardar PDF
    const fileName = reportType === "mensual" 
      ? `Reporte_${format(new Date(selectedMonth + "-01"), "MMMM_yyyy", { locale: es })}.pdf`
      : reportType === "personalizado"
      ? `Reporte_${format(new Date(startDate), "dd-MM-yyyy")}_${format(new Date(endDate), "dd-MM-yyyy")}.pdf`
      : `Reporte_Completo_${format(new Date(), "dd-MM-yyyy")}.pdf`;

    doc.save(fileName);
    setIsGenerating(false);
  };

  const filteredRecords = getFilteredRecords();
  const totalIngresos = filteredRecords
    .filter(r => r.type.toLowerCase().includes("ingreso"))
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);
  
  const totalEgresos = filteredRecords
    .filter(r => r.type.toLowerCase().includes("egreso"))
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);

  const saldo = totalIngresos - totalEgresos;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-white/60 text-sm md:text-base">Genera reportes detallados en formato PDF para presentaciones.</p>
        </div>
        <button 
          onClick={generateReport}
          disabled={isGenerating || filteredRecords.length === 0}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
        >
          <Download className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isGenerating ? 'Generando...' : 'Generar Reporte PDF'}</span>
          <span className="sm:hidden">{isGenerating ? 'Generando...' : 'Generar PDF'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Panel de Configuración */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Tipo de Reporte */}
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Tipo de Reporte
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              <button
                onClick={() => setReportType("mensual")}
                className={`p-3 md:p-4 rounded-lg border transition-all ${
                  reportType === "mensual"
                    ? "bg-primary/20 border-primary text-white"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-primary/50"
                }`}
              >
                <Calendar className="w-5 h-5 md:w-6 md:h-6 mb-2 mx-auto" />
                <p className="font-medium text-sm md:text-base">Mensual</p>
              </button>
              <button
                onClick={() => setReportType("personalizado")}
                className={`p-3 md:p-4 rounded-lg border transition-all ${
                  reportType === "personalizado"
                    ? "bg-primary/20 border-primary text-white"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-primary/50"
                }`}
              >
                <BarChart3 className="w-5 h-5 md:w-6 md:h-6 mb-2 mx-auto" />
                <p className="font-medium text-sm md:text-base">Personalizado</p>
              </button>
              <button
                onClick={() => setReportType("completo")}
                className={`p-3 md:p-4 rounded-lg border transition-all ${
                  reportType === "completo"
                    ? "bg-primary/20 border-primary text-white"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-primary/50"
                }`}
              >
                <PieChart className="w-5 h-5 md:w-6 md:h-6 mb-2 mx-auto" />
                <p className="font-medium text-sm md:text-base">Completo</p>
              </button>
            </div>
          </div>

          {/* Filtros según el tipo */}
          {reportType === "mensual" && (
            <div className="glass-panel p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Seleccionar Mes</h3>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input-premium w-full text-sm md:text-base"
              />
            </div>
          )}

          {reportType === "personalizado" && (
            <div className="glass-panel p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Rango de Fechas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="text-xs md:text-sm text-white/60 mb-2 block">Fecha Inicio</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-premium w-full text-sm md:text-base"
                  />
                </div>
                <div>
                  <label className="text-xs md:text-sm text-white/60 mb-2 block">Fecha Fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-premium w-full text-sm md:text-base"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Filtro de Categoría */}
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Categoría</h3>
            <div className="flex flex-wrap gap-2 md:gap-4">
              {["todos", "caja_chica", "fondo_ahorro"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat as any)}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg transition-all text-sm md:text-base ${
                    selectedCategory === cat
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {cat === "todos" ? "Todos" : cat === "caja_chica" ? "Caja Chica" : "Fondo de Ahorro"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de Vista Previa */}
        <div className="space-y-4 md:space-y-6">
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-accent" />
              Vista Previa
            </h3>
            {isLoading ? (
              <p className="text-white/50 text-xs md:text-sm">Cargando datos...</p>
            ) : (
              <div className="space-y-3 md:space-y-4">
                <div>
                  <p className="text-white/60 text-xs md:text-sm mb-1">Total Ingresos</p>
                  <p className="text-lg md:text-2xl font-bold text-success break-words">
                    ${totalIngresos.toLocaleString('es-CL')}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-xs md:text-sm mb-1">Total Egresos</p>
                  <p className="text-lg md:text-2xl font-bold text-danger break-words">
                    ${totalEgresos.toLocaleString('es-CL')}
                  </p>
                </div>
                <div className="pt-3 md:pt-4 border-t border-white/10">
                  <p className="text-white/60 text-xs md:text-sm mb-1">Saldo</p>
                  <p className={`text-lg md:text-2xl font-bold break-words ${saldo >= 0 ? 'text-success' : 'text-danger'}`}>
                    ${saldo.toLocaleString('es-CL')}
                  </p>
                </div>
                <div className="pt-3 md:pt-4 border-t border-white/10">
                  <p className="text-white/60 text-xs md:text-sm mb-1">Registros</p>
                  <p className="text-base md:text-xl font-semibold text-white">
                    {filteredRecords.length} registros
                  </p>
                </div>
              </div>
            )}
          </div>

          {filteredRecords.length === 0 && !isLoading && (
            <div className="glass-panel p-6 text-center">
              <p className="text-white/50 text-sm">
                No hay registros para el período seleccionado
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
