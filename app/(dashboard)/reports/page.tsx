"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart as PieChartIcon,
  Download,
  Calendar,
  FileText,
  BarChart3,
  TrendingUp,
  Tags,
  RefreshCw,
  AlertCircle,
  PartyPopper,
  HardHat,
  FileSpreadsheet,
  Users,
  Check,
  Wallet,
  ArrowUp,
  ArrowDown,
  Minus,
  Info,
} from "lucide-react";
import { fetchMovementsData, getAllCategoryOptions, logReportExport } from "@/app/actions/movements";
import { fetchAssemblyReportData } from "@/app/actions/reports";
import { getEventOptions } from "@/app/actions/events";
import { getProjectOptions } from "@/app/actions/projects";
import { buildCategoryBreakdown } from "@/lib/finance/category-breakdown";
import {
  buildCategoryPieData,
  buildFlowSummaryBarData,
} from "@/lib/finance/report-chart-data";
import { buildReportCsv, downloadCsvFile } from "@/lib/finance/report-export";
import {
  areReportFiltersValid,
  computeReportTotals,
  filterRecordsForReport,
  getReportFilterError,
  getReportPeriodLabel,
  type ReportFilters,
  type ReportFundFilter,
  type ReportType,
} from "@/lib/finance/report-filter";
import type { AssemblyReportSnapshot } from "@/lib/finance/assembly-report";
import {
  buildExecutiveSummary,
  formatMoney,
  formatShareOfTotal,
  getExportContents,
} from "@/lib/finance/report-narrative";
import {
  computeFundBalanceSnapshot,
  supportsFundBalanceSnapshot,
  type FundBalanceSnapshot,
} from "@/lib/finance/report-fund-balance";
import {
  buildPeriodComparison,
  computeActivityRoi,
  supportsPeriodComparison,
  type ComparisonMetric,
} from "@/lib/finance/report-period-comparison";
import {
  buildEventGoalFromRecords,
  generateActivityReportPdf,
  generateAssemblyReportPdf,
  generateStandardReportPdf,
} from "@/lib/finance/report-pdf";
import type { CategoryOption, EventOption, MovementRecord, ProjectOption } from "@/lib/finance/types";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type ChartBreakdownMode = "egreso" | "ingreso";
type ExportFormat = "pdf" | "csv";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => String(CURRENT_YEAR - i));

function FundBalancePanel({ snapshot }: { snapshot: FundBalanceSnapshot }) {
  return (
    <div className="pt-3 border-t border-white/10 space-y-2">
      <p className="text-white/50 text-xs uppercase tracking-wide flex items-center gap-1.5">
        <Wallet className="w-3.5 h-3.5" />
        Posición del fondo · {snapshot.fundLabel}
      </p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-white/40 mb-0.5">Inicial</p>
          <p className="font-mono text-white/80">{formatMoney(snapshot.saldoInicial)}</p>
        </div>
        <div>
          <p className="text-white/40 mb-0.5">Final</p>
          <p className="font-mono text-white/80">{formatMoney(snapshot.saldoFinal)}</p>
        </div>
        <div>
          <p className="text-white/40 mb-0.5">Cambio</p>
          <p
            className={`font-mono font-semibold ${
              snapshot.cambioSaldo >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {snapshot.cambioSaldo >= 0 ? "+" : ""}
            {formatMoney(snapshot.cambioSaldo)}
          </p>
        </div>
      </div>
      {snapshot.cajaChica && snapshot.fondoAhorro && (
        <p className="text-white/35 text-[11px] leading-snug">
          Caja {formatMoney(snapshot.cajaChica.saldoInicial)} → {formatMoney(snapshot.cajaChica.saldoFinal)}
          {" · "}
          Fondo {formatMoney(snapshot.fondoAhorro.saldoInicial)} →{" "}
          {formatMoney(snapshot.fondoAhorro.saldoFinal)}
        </p>
      )}
      <p className="text-white/30 text-[10px]">
        Incluye transferencias entre fondos. Distinto al resultado operativo del período.
      </p>
    </div>
  );
}

function ComparisonDelta({
  metric,
  previousLabel,
  invertColors = false,
}: {
  metric: ComparisonMetric;
  previousLabel: string;
  invertColors?: boolean;
}) {
  const deltaAmount = metric.current - metric.previous;

  if (!metric.hasPreviousData) {
    return <span className="text-white/30 text-[11px]">Sin datos en {previousLabel}</span>;
  }
  if (metric.direction === "new") {
    return (
      <span className="text-white/40 text-[11px]">
        {formatMoney(metric.current)} en este período (sin base en {previousLabel})
      </span>
    );
  }
  if (metric.deltaPercent === null || metric.direction === "flat") {
    return (
      <span className="text-white/40 text-[11px] flex items-center gap-0.5">
        <Minus className="w-3 h-3" />
        Sin cambio vs {previousLabel}
      </span>
    );
  }

  const isPositive = deltaAmount > 0;
  const isGood = invertColors ? !isPositive : isPositive;
  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isGood ? "text-success" : "text-danger";
  const useAbsolute =
    Math.abs(metric.deltaPercent) > 200 ||
    (Math.abs(metric.previous) < Math.abs(metric.current) * 0.05 &&
      Math.abs(metric.previous) > 0);

  if (useAbsolute) {
    return (
      <span className={`text-[11px] flex items-center gap-0.5 ${colorClass}`}>
        <Icon className="w-3 h-3" />
        {deltaAmount >= 0 ? "+" : ""}
        {formatMoney(deltaAmount)} vs {previousLabel}
      </span>
    );
  }

  return (
    <span className={`text-[11px] flex items-center gap-0.5 ${colorClass}`}>
      <Icon className="w-3 h-3" />
      {isPositive ? "+" : ""}
      {metric.deltaPercent}% vs {previousLabel}
      <span className="text-white/30 ml-0.5">
        ({deltaAmount >= 0 ? "+" : ""}
        {formatMoney(deltaAmount)})
      </span>
    </span>
  );
}

function buildExportFileName(
  filters: ReportFilters,
  extension: "pdf" | "csv",
  eventName?: string
): string {
  const suffix = extension;
  if (filters.reportType === "mensual") {
    return `Reporte_${format(parseISO(`${filters.selectedMonth}-01`), "MMMM_yyyy", { locale: es })}.${suffix}`;
  }
  if (filters.reportType === "anual") {
    return `Reporte_${filters.selectedYear}.${suffix}`;
  }
  if (filters.reportType === "asamblea") {
    return `Rendicion_Asamblea_${filters.selectedYear}.${suffix}`;
  }
  if (filters.reportType === "actividad" && filters.selectedMonth && eventName) {
    const monthSlug = format(parseISO(`${filters.selectedMonth}-01`), "MMMM_yyyy", { locale: es });
    const slug = eventName.replace(/[^\w\sáéíóúñ-]/gi, "").replace(/\s+/g, "_").slice(0, 40);
    return `Actividad_${slug}_${monthSlug}.${suffix}`;
  }
  if (filters.reportType === "personalizado") {
    return `Reporte_${format(parseISO(filters.startDate), "dd-MM-yyyy")}_${format(parseISO(filters.endDate), "dd-MM-yyyy")}.${suffix}`;
  }
  return `Reporte_Completo_${format(new Date(), "dd-MM-yyyy")}.${suffix}`;
}

export default function ReportsPage() {
  const [records, setRecords] = useState<MovementRecord[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<ReportType>("mensual");
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [selectedYear, setSelectedYear] = useState<string>(String(CURRENT_YEAR));
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedFund, setSelectedFund] = useState<ReportFundFilter>("todos");
  const [selectedClassCategory, setSelectedClassCategory] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [chartBreakdownMode, setChartBreakdownMode] = useState<ChartBreakdownMode>("egreso");
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [assemblySnapshot, setAssemblySnapshot] = useState<AssemblyReportSnapshot | null>(null);
  const [assemblyLoading, setAssemblyLoading] = useState(false);

  const isAssemblyMode = reportType === "asamblea";
  const isActivityMode = reportType === "actividad";
  const selectedActivity = events.find((event) => event.id === selectedEventId) ?? null;

  const filters: ReportFilters = useMemo(
    () => ({
      reportType,
      selectedMonth,
      selectedYear,
      startDate,
      endDate,
      selectedFund,
      selectedClassCategory,
      selectedEventId,
      selectedProjectId,
    }),
    [
      reportType,
      selectedMonth,
      selectedYear,
      startDate,
      endDate,
      selectedFund,
      selectedClassCategory,
      selectedEventId,
      selectedProjectId,
    ]
  );

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      setError(null);

      const [data, cats, evts, projs] = await Promise.all([
        fetchMovementsData(),
        getAllCategoryOptions(),
        getEventOptions(),
        getProjectOptions(),
      ]);
      setRecords(data);
      setCategories(cats);
      setEvents(evts);
      setProjects(projs);
    } catch (err) {
      setError("Error al cargar los datos. Por favor, intenta de nuevo.");
      console.error("Error loading reports data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadAssemblyData = useCallback(async () => {
    if (!isAssemblyMode || !selectedYear) return;

    setAssemblyLoading(true);
    try {
      const snapshot = await fetchAssemblyReportData(selectedYear);
      setAssemblySnapshot(snapshot);
      setError(null);
    } catch (err) {
      setAssemblySnapshot(null);
      setError("Error al cargar datos de asamblea. Intenta de nuevo.");
      console.error("Error loading assembly data:", err);
    } finally {
      setAssemblyLoading(false);
    }
  }, [isAssemblyMode, selectedYear]);

  useEffect(() => {
    if (isAssemblyMode) {
      loadAssemblyData();
    } else {
      setAssemblySnapshot(null);
    }
  }, [isAssemblyMode, loadAssemblyData]);

  const handleReportTypeChange = (type: ReportType) => {
    setReportType(type);
    if (type === "asamblea") {
      setSelectedFund("todos");
      setSelectedEventId("");
      setSelectedProjectId("");
      setSelectedClassCategory("");
    }
    if (type === "actividad") {
      setSelectedProjectId("");
      setSelectedClassCategory("");
    }
  };

  const filterError = getReportFilterError(filters);
  const filtersValid = areReportFiltersValid(filters);
  const periodLabel = getReportPeriodLabel(filters);

  const filteredRecords = useMemo(
    () => filterRecordsForReport(records, filters),
    [records, filters]
  );

  const reportTotals = useMemo(
    () => computeReportTotals(filteredRecords),
    [filteredRecords]
  );

  const activeRecords = useMemo(
    () => (isAssemblyMode ? (assemblySnapshot?.yearRecords ?? []) : filteredRecords),
    [isAssemblyMode, assemblySnapshot?.yearRecords, filteredRecords]
  );
  const activeTotals = isAssemblyMode
    ? (assemblySnapshot?.periodTotals ?? {
        totalIngresos: 0,
        totalEgresos: 0,
        resultado: 0,
        transferCount: 0,
        transferMovementCount: 0,
        operationalCount: 0,
        totalCount: 0,
        operational: [],
        transfers: [],
      })
    : reportTotals;

  const selectedEventGoal = useMemo(() => {
    if (!selectedEventId || isAssemblyMode) return null;
    const event = events.find((item) => item.id === selectedEventId);
    if (!event) return null;
    return buildEventGoalFromRecords(event.name, event.goal, activeTotals.operational);
  }, [selectedEventId, isAssemblyMode, events, activeTotals.operational]);

  const activityRoi = useMemo(() => {
    if (!selectedEventGoal) return null;
    return computeActivityRoi(selectedEventGoal.profit, selectedEventGoal.totalExpense);
  }, [selectedEventGoal]);

  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(activeTotals.operational),
    [activeTotals.operational]
  );

  const expenseBreakdown = useMemo(
    () => categoryBreakdown.filter((item) => item.type === "Egreso"),
    [categoryBreakdown]
  );

  const incomeBreakdown = useMemo(
    () => categoryBreakdown.filter((item) => item.type === "Ingreso"),
    [categoryBreakdown]
  );

  const pieChartData = useMemo(
    () =>
      buildCategoryPieData(
        chartBreakdownMode === "egreso" ? expenseBreakdown : incomeBreakdown
      ),
    [chartBreakdownMode, expenseBreakdown, incomeBreakdown]
  );

  const barChartData = useMemo(
    () => buildFlowSummaryBarData(activeTotals.totalIngresos, activeTotals.totalEgresos),
    [activeTotals.totalIngresos, activeTotals.totalEgresos]
  );

  const activePieBreakdown = chartBreakdownMode === "egreso" ? expenseBreakdown : incomeBreakdown;
  const pieBreakdownTotal = useMemo(
    () => activePieBreakdown.reduce((sum, item) => sum + item.total, 0),
    [activePieBreakdown]
  );
  const showPieChart = pieChartData.length >= 2;

  const executiveSummary = useMemo(() => {
    if (isAssemblyMode || isActivityMode) return null;
    return buildExecutiveSummary(
      activeTotals.operational,
      incomeBreakdown,
      expenseBreakdown,
      activeTotals.totalIngresos,
      activeTotals.totalEgresos,
      selectedFund,
      selectedEventId ? events.find((e) => e.id === selectedEventId)?.name ?? null : null,
      selectedProjectId ? projects.find((p) => p.id === selectedProjectId)?.name ?? null : null
    );
  }, [
    isAssemblyMode,
    isActivityMode,
    activeTotals,
    incomeBreakdown,
    expenseBreakdown,
    selectedFund,
    selectedEventId,
    selectedProjectId,
    events,
    projects,
  ]);

  const exportChecklistPdf = useMemo(
    () =>
      getExportContents({
        reportType,
        hasTransfers: activeTotals.transferCount > 0,
        hasEventFilter: !!selectedEventId,
        hasProjectFilter: !!selectedProjectId,
        format: "pdf",
      }),
    [reportType, activeTotals.transferCount, selectedEventId, selectedProjectId]
  );

  const exportChecklistCsv = useMemo(
    () =>
      getExportContents({
        reportType,
        hasTransfers: activeTotals.transferCount > 0,
        hasEventFilter: !!selectedEventId,
        hasProjectFilter: !!selectedProjectId,
        format: "csv",
      }),
    [reportType, activeTotals.transferCount, selectedEventId, selectedProjectId]
  );

  const isPageLoading = isLoading || (isAssemblyMode && assemblyLoading);

  const periodComparison = useMemo(() => {
    if (isAssemblyMode || isPageLoading || !filtersValid) return null;
    if (!supportsPeriodComparison(reportType)) return null;
    return buildPeriodComparison(records, filters);
  }, [isAssemblyMode, isPageLoading, filtersValid, reportType, records, filters]);

  const fundBalanceSnapshot = useMemo(() => {
    if (isAssemblyMode || isPageLoading || !filtersValid) return null;
    if (!supportsFundBalanceSnapshot(reportType)) return null;
    return computeFundBalanceSnapshot(records, filters);
  }, [isAssemblyMode, isPageLoading, filtersValid, reportType, records, filters]);

  const showExportPreview =
    !isPageLoading && (isAssemblyMode ? !!assemblySnapshot : filtersValid && activeRecords.length > 0);

  const canExport =
    filtersValid &&
    activeRecords.length > 0 &&
    !exportingFormat &&
    !isPageLoading &&
    (!isAssemblyMode || assemblySnapshot !== null);

  const handleFundChange = (fund: ReportFundFilter) => {
    setSelectedFund(fund);
    if (fund === "caja_chica") setSelectedProjectId("");
  };

  const exportCsv = async () => {
    if (!canExport) return;

    setExportingFormat("csv");
    try {
      const fileName = buildExportFileName(filters, "csv", selectedActivity?.name);
      const csv = buildReportCsv(activeRecords);
      downloadCsvFile(csv, fileName);

      await logReportExport({
        format: "csv",
        reportType,
        selectedFund,
        selectedClassCategory,
        selectedEventId,
        selectedProjectId,
        selectedYear: reportType === "anual" || reportType === "asamblea" ? selectedYear : undefined,
        recordCount: activeRecords.length,
        operationalCount: activeTotals.operationalCount,
        transferCount: activeTotals.transferCount,
        totalIngresos: activeTotals.totalIngresos,
        totalEgresos: activeTotals.totalEgresos,
        resultado: activeTotals.resultado,
        fileName,
      });
    } catch (err) {
      console.error("Error exporting CSV:", err);
      setError("No se pudo exportar el CSV. Intenta de nuevo.");
    } finally {
      setExportingFormat(null);
    }
  };

  const exportPdf = async () => {
    if (!canExport) return;

    setExportingFormat("pdf");

    try {
      const fileName = buildExportFileName(filters, "pdf", selectedActivity?.name);
      const doc =
        isAssemblyMode && assemblySnapshot
          ? await generateAssemblyReportPdf(assemblySnapshot)
          : isActivityMode && selectedEventGoal && selectedActivity
            ? await generateActivityReportPdf({
                activityName: selectedActivity.name,
                periodLabel,
                fundLabel:
                  selectedFund !== "todos"
                    ? selectedFund === "caja_chica"
                      ? "Caja Chica"
                      : "Fondo de Ahorro"
                    : undefined,
                eventGoal: selectedEventGoal,
                roiPercent: activityRoi,
                reportTotals: activeTotals,
                categoryBreakdown,
                fundBalance: fundBalanceSnapshot ?? undefined,
              })
            : await generateStandardReportPdf({
            periodLabel,
            fundLabel:
              selectedFund !== "todos"
                ? selectedFund === "caja_chica"
                  ? "Caja Chica"
                  : "Fondo de Ahorro"
                : undefined,
            categoryLabel: selectedClassCategory
              ? categories.find((c) => c.id === selectedClassCategory)?.name
              : undefined,
            eventLabel: selectedEventId
              ? events.find((e) => e.id === selectedEventId)?.name
              : undefined,
            projectLabel: selectedProjectId
              ? projects.find((p) => p.id === selectedProjectId)?.name
              : undefined,
            eventGoal: selectedEventGoal ?? undefined,
            reportTotals: activeTotals,
            categoryBreakdown,
            fundBalance: fundBalanceSnapshot ?? undefined,
          });

      doc.save(fileName);

      await logReportExport({
        format: "pdf",
        reportType,
        selectedFund,
        selectedClassCategory,
        selectedEventId,
        selectedProjectId,
        selectedYear: reportType === "anual" || reportType === "asamblea" ? selectedYear : undefined,
        recordCount: activeRecords.length,
        operationalCount: activeTotals.operationalCount,
        transferCount: activeTotals.transferCount,
        totalIngresos: activeTotals.totalIngresos,
        totalEgresos: activeTotals.totalEgresos,
        resultado: activeTotals.resultado,
        fileName,
      });
    } catch (err) {
      console.error("Error generating report:", err);
      setError("No se pudo generar el reporte. Intenta de nuevo.");
    } finally {
      setExportingFormat(null);
    }
  };

  const previewMessage = (() => {
    if (isPageLoading) return null;
    if (error) return error;
    if (filterError) return filterError;
    if (filtersValid && activeRecords.length === 0) {
      return "No hay registros para los filtros seleccionados.";
    }
    return null;
  })();

  const showCharts = !isPageLoading && filtersValid && activeRecords.length > 0 && !isAssemblyMode;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reportes</h1>
          <p className="text-white/60 text-sm md:text-base">
            {isAssemblyMode
              ? "Rendición de cuentas para asamblea con saldos, actividades y proyectos."
              : isActivityMode
                ? "Rendición por actividad con ganancia, ROI y PDF listo para presentar."
                : "Por fondo, actividad, proyecto y categoría con vista analítica."}
          </p>
        </div>
        <div className="grid grid-cols-3 sm:flex sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => (isAssemblyMode ? loadAssemblyData() : loadData(true))}
            disabled={isRefreshing || isPageLoading}
            className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 text-xs sm:text-sm px-2 sm:px-4"
          >
            <RefreshCw className={`w-4 h-4 flex-shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isRefreshing ? "Actualizando..." : "Actualizar"}</span>
          </button>
          <button
            onClick={exportCsv}
            disabled={!canExport}
            className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-2 sm:px-4"
          >
            <FileSpreadsheet className={`w-4 h-4 flex-shrink-0 ${exportingFormat === "csv" ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">{exportingFormat === "csv" ? "Exportando..." : "CSV"}</span>
          </button>
          <button
            onClick={exportPdf}
            disabled={!canExport}
            className="btn-primary flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-2 sm:px-4"
          >
            <Download className={`w-4 h-4 flex-shrink-0 ${exportingFormat === "pdf" ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{exportingFormat === "pdf" ? "Generando..." : "PDF"}</span>
          </button>
        </div>
      </div>

      {error && !isPageLoading && (
        <div className="mb-4 glass-panel p-4 border border-danger/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {showExportPreview && (
        <div className="glass-panel p-4 md:p-5 mb-4 md:mb-6">
          <p className="text-sm font-semibold mb-3">Este reporte incluirá</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wide mb-2">PDF</p>
              <ul className="space-y-1.5">
                {exportChecklistPdf.map((item) => (
                  <li
                    key={item.label}
                    className={`flex items-start gap-2 text-xs ${
                      item.included ? "text-white/70" : "text-white/30"
                    }`}
                  >
                    <Check
                      className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                        item.included ? "text-success" : "text-white/20"
                      }`}
                    />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wide mb-2">CSV</p>
              <ul className="space-y-1.5">
                {exportChecklistCsv.map((item) => (
                  <li key={item.label} className="flex items-start gap-2 text-xs text-white/70">
                    <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-success" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel p-4 md:p-6 mb-4 md:mb-6">
        <h3 className="text-base md:text-lg font-semibold mb-3 md:mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Tipo de Reporte
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none md:grid md:grid-cols-6 md:overflow-visible md:gap-3">
          {(
            [
              { type: "mensual" as const, label: "Mensual", icon: Calendar },
              { type: "anual" as const, label: "Año actual", icon: BarChart3 },
              { type: "actividad" as const, label: "Actividad", icon: PartyPopper },
              { type: "asamblea" as const, label: "Asamblea", icon: Users },
              { type: "personalizado" as const, label: "Personalizado", icon: TrendingUp },
              { type: "completo" as const, label: "Completo", icon: PieChartIcon },
            ] as const
          ).map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => handleReportTypeChange(type)}
              title={
                type === "asamblea"
                  ? "Resumen simplificado para presentar a socios y apoderados en asamblea."
                  : type === "actividad"
                    ? "Rendición por actividad con ganancia, ROI y comparación mensual."
                    : undefined
              }
              className={`flex-shrink-0 min-w-[7.25rem] md:min-w-0 p-3 md:p-4 rounded-lg border transition-all ${
                reportType === type
                  ? "bg-primary/20 border-primary text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-primary/50"
              }`}
            >
              <Icon className="w-5 h-5 md:w-6 md:h-6 mb-1.5 md:mb-2 mx-auto" />
              <p className="font-medium text-xs md:text-sm whitespace-nowrap">{label}</p>
            </button>
          ))}
        </div>
      </div>

      {isAssemblyMode ? (
        <div className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,280px)_1fr] gap-4">
            <div className="glass-panel p-4 md:p-6">
              <h3 className="font-semibold mb-3">Año de la asamblea</h3>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="select-premium w-full"
              >
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                    {year === String(CURRENT_YEAR) ? " (actual)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="glass-panel p-4 md:p-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm leading-relaxed">
                  <p className="text-white/80 font-medium">
                    Resumen simplificado para presentar a socios y apoderados en asamblea.
                  </p>
                  <p className="text-white/50">
                    Incluye saldos de tesorería, resultado anual sin transferencias, actividades con
                    meta y ganancia, y proyectos con avance. Los datos se calculan en el servidor.
                  </p>
                  <p className="text-white/35 text-xs">
                    No incluye detalle movimiento a movimiento ni gráficos — ideal para proyección en
                    reunión.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isPageLoading ? (
            <div className="glass-panel p-8 text-center text-white/50">Cargando datos de asamblea...</div>
          ) : previewMessage ? (
            <div className="glass-panel p-6 text-white/50 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/40" />
              {previewMessage}
            </div>
          ) : assemblySnapshot ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="glass-panel p-4 col-span-2 lg:col-span-1">
                  <p className="text-white/60 text-xs mb-1">Saldo total</p>
                  <p className="text-lg md:text-xl font-bold">
                    ${assemblySnapshot.saldoTotal.toLocaleString("es-CL")}
                  </p>
                  <p className="text-white/40 text-[11px] mt-1 leading-snug">
                    Caja ${assemblySnapshot.saldoCajaChica.toLocaleString("es-CL")} · Fondo{" "}
                    ${assemblySnapshot.saldoFondoAhorro.toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <p className="text-white/60 text-xs mb-1">Ingresos {selectedYear}</p>
                  <p className="text-lg md:text-xl font-bold text-success">
                    ${activeTotals.totalIngresos.toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <p className="text-white/60 text-xs mb-1">Egresos {selectedYear}</p>
                  <p className="text-lg md:text-xl font-bold text-danger">
                    ${activeTotals.totalEgresos.toLocaleString("es-CL")}
                  </p>
                </div>
                <div className="glass-panel p-4">
                  <p className="text-white/60 text-xs mb-1">Resultado {selectedYear}</p>
                  <p
                    className={`text-lg md:text-xl font-bold ${
                      activeTotals.resultado >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    ${activeTotals.resultado.toLocaleString("es-CL")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
                <div className="glass-panel p-4 md:p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <PartyPopper className="w-5 h-5 text-accent" />
                    Actividades del año
                  </h3>
                  {assemblySnapshot.events.length > 0 ? (
                    <div className="space-y-3">
                      {assemblySnapshot.events.map((event) => (
                        <div key={event.id} className="border border-white/10 rounded-lg p-3 md:p-4">
                          <p className="font-medium text-sm md:text-base">{event.name}</p>
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs md:text-sm">
                            <div>
                              <p className="text-white/50">Ingresos</p>
                              <p className="text-success font-mono">
                                ${event.totalIncome.toLocaleString("es-CL")}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">Gastos</p>
                              <p className="text-danger font-mono">
                                ${event.totalExpense.toLocaleString("es-CL")}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">Ganancia</p>
                              <p
                                className={`font-mono font-semibold ${
                                  event.profit >= 0 ? "text-success" : "text-danger"
                                }`}
                              >
                                ${event.profit.toLocaleString("es-CL")}
                              </p>
                            </div>
                            {event.goal != null && (
                              <div>
                                <p className="text-white/50">Meta</p>
                                <p className="font-mono">
                                  ${event.goal.toLocaleString("es-CL")}
                                  {event.goalProgress != null ? ` (${event.goalProgress}%)` : ""}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/40 text-sm">Sin actividades con movimientos en {selectedYear}.</p>
                  )}
                </div>

                <div className="glass-panel p-4 md:p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <HardHat className="w-5 h-5 text-primary" />
                    Proyectos del año
                  </h3>
                  {assemblySnapshot.projects.length > 0 ? (
                    <div className="space-y-3">
                      {assemblySnapshot.projects.map((project) => (
                        <div key={project.id} className="border border-white/10 rounded-lg p-3 md:p-4">
                          <p className="font-medium text-sm md:text-base">{project.name}</p>
                          <div className="mt-2 grid grid-cols-3 gap-3 text-xs md:text-sm">
                            <div>
                              <p className="text-white/50">
                                {project.fundingMode === "EXECUTION" ? "Presupuesto" : "Meta"}
                              </p>
                              <p className="font-mono">${project.targetAmount.toLocaleString("es-CL")}</p>
                            </div>
                            <div>
                              <p className="text-white/50">
                                {project.fundingMode === "EXECUTION" ? "Gastos" : "Ingresos"}
                              </p>
                              <p
                                className={`font-mono ${
                                  project.fundingMode === "EXECUTION" ? "text-danger" : "text-success"
                                }`}
                              >
                                $
                                {(project.fundingMode === "EXECUTION"
                                  ? project.totalExpense
                                  : project.totalIncome
                                ).toLocaleString("es-CL")}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">
                                {project.fundingMode === "EXECUTION" ? "Ejecutado" : "Avance"}
                              </p>
                              <p className="font-mono text-accent">
                                {project.fundingMode === "EXECUTION"
                                  ? `${project.executionProgress ?? 0}%`
                                  : `${project.progress ?? 0}%`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-white/40 text-sm">Sin proyectos con movimientos en {selectedYear}.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : isActivityMode ? (
        <div className="space-y-4 md:space-y-6">
          <div className="glass-panel p-4 md:p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-accent" />
                Actividad
              </h3>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="select-premium w-full"
              >
                <option value="">Selecciona una actividad...</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              {filterError && !selectedEventId && (
                <p className="text-danger text-sm mt-2 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {filterError}
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-white/10">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Mes del reporte
              </h3>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input-premium w-full"
              />
            </div>

            <div className="pt-4 border-t border-white/10">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent" />
                Fondo
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                {(["todos", "caja_chica", "fondo_ahorro"] as const).map((fund) => (
                  <button
                    key={fund}
                    onClick={() => handleFundChange(fund)}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      selectedFund === fund
                        ? "bg-primary/20 border-primary text-white"
                        : "bg-white/5 border-white/10 text-white/60 hover:border-primary/40"
                    }`}
                  >
                    {fund === "todos" ? "Todos" : fund === "caja_chica" ? "Caja Chica" : "Fondo de Ahorro"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isPageLoading ? (
            <div className="glass-panel p-8 text-center text-white/50">Cargando datos...</div>
          ) : previewMessage ? (
            <div className="glass-panel p-6 text-white/50 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/40" />
              {previewMessage}
            </div>
          ) : selectedEventGoal && selectedActivity ? (
            <>
              <div className="glass-panel p-4 md:p-5">
                <p className="text-white/50 text-sm mb-1">{periodLabel}</p>
                <h2 className="text-xl md:text-2xl font-bold">{selectedActivity.name}</h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <div className="glass-panel p-4">
                  <p className="text-white/60 text-xs mb-1">Ingresos</p>
                  <p className="text-lg md:text-xl font-bold text-success font-mono">
                    {formatMoney(selectedEventGoal.totalIncome)}
                  </p>
                  {periodComparison && (
                    <div className="mt-2">
                      <ComparisonDelta
                        metric={periodComparison.ingresos}
                        previousLabel={periodComparison.previousLabel}
                      />
                    </div>
                  )}
                </div>
                <div className="glass-panel p-4">
                  <p className="text-white/60 text-xs mb-1">Gastos</p>
                  <p className="text-lg md:text-xl font-bold text-danger font-mono">
                    {formatMoney(selectedEventGoal.totalExpense)}
                  </p>
                  {periodComparison && (
                    <div className="mt-2">
                      <ComparisonDelta
                        metric={periodComparison.egresos}
                        previousLabel={periodComparison.previousLabel}
                        invertColors
                      />
                    </div>
                  )}
                </div>
                <div className="glass-panel p-4">
                  <p className="text-white/60 text-xs mb-1">Ganancia</p>
                  <p
                    className={`text-lg md:text-xl font-bold font-mono ${
                      selectedEventGoal.profit >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {selectedEventGoal.profit >= 0 ? "+" : ""}
                    {formatMoney(selectedEventGoal.profit)}
                  </p>
                  {periodComparison && (
                    <div className="mt-2">
                      <ComparisonDelta
                        metric={periodComparison.resultado}
                        previousLabel={periodComparison.previousLabel}
                      />
                    </div>
                  )}
                </div>
                <div className="glass-panel p-4">
                  <p className="text-white/60 text-xs mb-1">ROI</p>
                  <p className="text-lg md:text-xl font-bold text-accent font-mono">
                    {activityRoi != null ? `${activityRoi}%` : "—"}
                  </p>
                  <p className="text-white/40 text-[11px] mt-2">Ganancia / gastos</p>
                </div>
              </div>

              <div className="glass-panel p-4 md:p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  Meta vs real
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {selectedEventGoal.goal != null && (
                    <div>
                      <p className="text-white/50 text-xs mb-1">Meta</p>
                      <p className="font-mono font-semibold">{formatMoney(selectedEventGoal.goal)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/50 text-xs mb-1">Ingresos</p>
                    <p className="font-mono text-success">{formatMoney(selectedEventGoal.totalIncome)}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Gastos</p>
                    <p className="font-mono text-danger">{formatMoney(selectedEventGoal.totalExpense)}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Avance meta</p>
                    <p className="font-mono text-accent">
                      {selectedEventGoal.goalProgress != null ? `${selectedEventGoal.goalProgress}%` : "—"}
                    </p>
                  </div>
                </div>
                <p className="text-white/40 text-xs mt-4">
                  {activeTotals.operationalCount} movimientos operativos
                  {activeTotals.transferCount > 0 &&
                    ` · ${activeTotals.transferCount} transferencia${activeTotals.transferCount !== 1 ? "s" : ""}`}
                </p>
              </div>

              {fundBalanceSnapshot && (
                <div className="glass-panel p-4 md:p-6">
                  <FundBalancePanel snapshot={fundBalanceSnapshot} />
                </div>
              )}

              {(incomeBreakdown.length > 0 || expenseBreakdown.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {incomeBreakdown.length > 0 && (
                    <div className="glass-panel p-4 md:p-6">
                      <h3 className="font-semibold mb-3 text-sm">Ingresos por categoría</h3>
                      <div className="space-y-2">
                        {incomeBreakdown.slice(0, 6).map((item) => (
                          <div key={item.categoryId} className="flex justify-between text-xs gap-2">
                            <span className="text-white/70 truncate">{item.categoryName}</span>
                            <span className="text-success font-mono flex-shrink-0">
                              {formatMoney(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {expenseBreakdown.length > 0 && (
                    <div className="glass-panel p-4 md:p-6">
                      <h3 className="font-semibold mb-3 text-sm">Gastos por categoría</h3>
                      <div className="space-y-2">
                        {expenseBreakdown.slice(0, 6).map((item) => (
                          <div key={item.categoryId} className="flex justify-between text-xs gap-2">
                            <span className="text-white/70 truncate">{item.categoryName}</span>
                            <span className="text-danger font-mono flex-shrink-0">
                              {formatMoney(item.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="glass-panel p-4 md:p-6 space-y-4">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Período
              </h3>
              {reportType === "mensual" && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input-premium w-full"
                />
              )}
              {reportType === "anual" && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="select-premium w-full"
                >
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                      {year === String(CURRENT_YEAR) ? " (actual)" : ""}
                    </option>
                  ))}
                </select>
              )}
              {reportType === "personalizado" && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="input-premium w-full"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="input-premium w-full"
                    />
                  </div>
                  {filterError && (
                    <p className="text-danger text-sm mt-2 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {filterError}
                    </p>
                  )}
                </>
              )}
              {reportType === "completo" && (
                <p className="text-white/50 text-sm">Todos los registros históricos.</p>
              )}
            </div>

            <div className="pt-4 border-t border-white/10">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-accent" />
                Fondo
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                {(["todos", "caja_chica", "fondo_ahorro"] as const).map((fund) => (
                  <button
                    key={fund}
                    onClick={() => handleFundChange(fund)}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      selectedFund === fund
                        ? "bg-primary/20 border-primary text-white"
                        : "bg-white/5 border-white/10 text-white/60 hover:border-primary/40"
                    }`}
                  >
                    {fund === "todos" ? "Todos" : fund === "caja_chica" ? "Caja Chica" : "Fondo de Ahorro"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 md:p-6 space-y-4">
            <p className="text-white/40 text-xs uppercase tracking-wide">Filtros adicionales</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <PartyPopper className="w-4 h-4 text-accent" />
                  Actividad
                </h3>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="select-premium w-full"
                >
                  <option value="">Todas las actividades</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-primary" />
                  Proyecto
                </h3>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={selectedFund === "caja_chica"}
                  className="select-premium w-full disabled:opacity-50"
                >
                  <option value="">Todos los proyectos</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {selectedFund === "caja_chica" && (
                  <p className="text-white/40 text-xs mt-1">Los proyectos pertenecen al Fondo de Ahorro.</p>
                )}
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
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Resumen ejecutivo
            </h3>
            {executiveSummary && (
              <div className="mb-4 space-y-1">
                <p className="text-white/40 text-xs">
                  {periodLabel} · {executiveSummary.fundLabel}
                </p>
                {periodComparison && (
                  <p className="text-white/30 text-[10px]">
                    Variación bajo cada total: cambio respecto a {periodComparison.previousLabel}
                  </p>
                )}
              </div>
            )}
            {isPageLoading ? (
              <p className="text-white/50 text-sm">Cargando...</p>
            ) : previewMessage ? (
              <p className="text-white/50 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-white/40" />
                {previewMessage}
              </p>
            ) : executiveSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-white/60 text-sm">Ingresos</span>
                      <span className="text-lg font-bold text-success font-mono">
                        {formatMoney(activeTotals.totalIngresos)}
                      </span>
                    </div>
                    {periodComparison && (
                      <ComparisonDelta
                        metric={periodComparison.ingresos}
                        previousLabel={periodComparison.previousLabel}
                      />
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-white/60 text-sm">Egresos</span>
                      <span className="text-lg font-bold text-danger font-mono">
                        {formatMoney(activeTotals.totalEgresos)}
                      </span>
                    </div>
                    {periodComparison && (
                      <ComparisonDelta
                        metric={periodComparison.egresos}
                        previousLabel={periodComparison.previousLabel}
                        invertColors
                      />
                    )}
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex justify-between items-baseline">
                      <span className="text-white/60 text-sm font-medium">Resultado</span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          activeTotals.resultado >= 0 ? "text-success" : "text-danger"
                        }`}
                      >
                        {activeTotals.resultado >= 0 ? "+" : ""}
                        {formatMoney(activeTotals.resultado)}
                      </span>
                    </div>
                    {periodComparison && (
                      <ComparisonDelta
                        metric={periodComparison.resultado}
                        previousLabel={periodComparison.previousLabel}
                      />
                    )}
                  </div>
                </div>

                {fundBalanceSnapshot && <FundBalancePanel snapshot={fundBalanceSnapshot} />}

                {executiveSummary.topIncomes.length > 0 && (
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wide mb-1">
                      Principales ingresos
                    </p>
                    <p className="text-white/30 text-[10px] mb-2">
                      % = participación sobre el total de ingresos del período
                    </p>
                    <div className="space-y-2">
                      {executiveSummary.topIncomes.map((item) => (
                        <div key={item.label} className="flex justify-between gap-2 text-xs">
                          <span className="text-white/70 truncate">{item.label}</span>
                          <div className="text-right flex-shrink-0">
                            <p className="text-success font-mono">{formatMoney(item.amount)}</p>
                            {incomeBreakdown.length > 1 && (
                              <p className="text-white/35 text-[10px]">
                                {formatShareOfTotal(item.sharePercent, "ingresos")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {executiveSummary.topExpenses.length > 0 && (
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wide mb-1">
                      Principales gastos
                    </p>
                    <p className="text-white/30 text-[10px] mb-2">
                      % = participación sobre el total de gastos del período
                    </p>
                    <div className="space-y-2">
                      {executiveSummary.topExpenses.map((item) => (
                        <div key={item.label} className="flex justify-between gap-2 text-xs">
                          <span className="text-white/70 truncate">{item.label}</span>
                          <div className="text-right flex-shrink-0">
                            <p className="text-danger font-mono">{formatMoney(item.amount)}</p>
                            {expenseBreakdown.length > 1 && (
                              <p className="text-white/35 text-[10px]">
                                {formatShareOfTotal(item.sharePercent, "gastos")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-white/50">Actividad principal</span>
                    <span className="text-white/80 text-right">
                      {executiveSummary.filteredActivityName ??
                        (executiveSummary.mainActivity
                          ? `${executiveSummary.mainActivity.name} (${formatMoney(executiveSummary.mainActivity.income)})`
                          : "Ninguna")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/50">Proyecto</span>
                    <span className="text-white/80 text-right">
                      {executiveSummary.filteredProjectName ??
                        (executiveSummary.mainProject?.name ?? "Ninguno")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-white/50">Movimientos</span>
                    <span className="text-white/80">{activeTotals.operationalCount} operativos</span>
                  </div>
                  {activeTotals.transferCount > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-white/50">Transferencias</span>
                      <span className="text-white/80">{activeTotals.transferCount}</span>
                    </div>
                  )}
                </div>

                {selectedEventGoal && (
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-accent text-xs font-medium mb-2 flex items-center gap-1.5">
                      <PartyPopper className="w-3.5 h-3.5" />
                      Meta vs real — {selectedEventGoal.name}
                    </p>
                    <div className="space-y-1 text-xs">
                      {selectedEventGoal.goal != null && (
                        <div className="flex justify-between">
                          <span className="text-white/50">Meta</span>
                          <span className="font-mono">{formatMoney(selectedEventGoal.goal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-white/50">Ganancia</span>
                        <span
                          className={`font-mono font-semibold ${
                            selectedEventGoal.profit >= 0 ? "text-success" : "text-danger"
                          }`}
                        >
                          {formatMoney(selectedEventGoal.profit)}
                        </span>
                      </div>
                      {selectedEventGoal.goalProgress != null && (
                        <p className="text-white/40">Avance meta: {selectedEventGoal.goalProgress}%</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      )}

      {showCharts && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="glass-panel p-4 md:p-6 min-h-[280px] flex flex-col">
            <h3 className="font-semibold mb-3">Ingresos vs Egresos</h3>
            <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs md:text-sm">
              <div className="rounded-lg bg-success/10 px-2 py-2">
                <p className="text-white/50 mb-0.5">Ingresos</p>
                <p className="font-mono font-semibold text-success">
                  {formatMoney(activeTotals.totalIngresos)}
                </p>
              </div>
              <div className="rounded-lg bg-danger/10 px-2 py-2">
                <p className="text-white/50 mb-0.5">Egresos</p>
                <p className="font-mono font-semibold text-danger">
                  {formatMoney(activeTotals.totalEgresos)}
                </p>
              </div>
              <div className="rounded-lg bg-white/5 px-2 py-2">
                <p className="text-white/50 mb-0.5">Resultado</p>
                <p
                  className={`font-mono font-semibold ${
                    activeTotals.resultado >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {activeTotals.resultado >= 0 ? "+" : ""}
                  {formatMoney(activeTotals.resultado)}
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.3)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `$${value >= 1000 ? `${Math.round(value / 1000)}k` : value}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1d2d",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(value) => [`$${Number(value).toLocaleString("es-CL")}`, "Monto"]}
                  />
                  <Bar dataKey="monto" radius={[6, 6, 0, 0]}>
                    {barChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-4 md:p-6 min-h-[280px] flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold">Distribución por categoría</h3>
              <select
                value={chartBreakdownMode}
                onChange={(e) => setChartBreakdownMode(e.target.value as ChartBreakdownMode)}
                className="select-premium py-1.5 text-xs w-auto min-w-[120px]"
              >
                <option value="egreso">Gastos</option>
                <option value="ingreso">Ingresos</option>
              </select>
            </div>
            <div className="flex-1 min-h-[200px]">
              {activePieBreakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/40 text-sm">
                  Sin {chartBreakdownMode === "egreso" ? "gastos" : "ingresos"} en este período
                </div>
              ) : showPieChart ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {pieChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1d2d",
                        borderColor: "rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "#fff",
                      }}
                      formatter={(value) => [`$${Number(value).toLocaleString("es-CL")}`, "Total"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col justify-center gap-2 px-2">
                  {activePieBreakdown.map((item) => {
                    const pct =
                      pieBreakdownTotal > 0
                        ? Math.round((item.total / pieBreakdownTotal) * 100)
                        : 100;
                    return (
                      <div
                        key={`${item.categoryId}-${item.type}`}
                        className="flex justify-between items-center text-sm border-b border-white/5 pb-2"
                      >
                        <span className="text-white/80">{item.categoryName}</span>
                        <span className="font-mono text-white/60">
                          {pct}% · {formatMoney(item.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {showPieChart && pieChartData.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pieChartData.map((item) => (
                  <span
                    key={item.name}
                    className="inline-flex items-center gap-1.5 text-xs text-white/60"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="truncate max-w-[120px]">{item.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
