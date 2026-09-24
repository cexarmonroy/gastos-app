"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Plus,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  ClipboardList,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Check,
  Loader2,
  PartyPopper,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toCalendarDate } from "@/lib/date-only";
import { RecordModal } from "@/components/ui/RecordModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  applyBulkCategorySuggestion,
  applyCategorySuggestion,
  fetchMovementsData,
  getAllCategoryOptions,
  logReportExport,
  voidMovement,
} from "@/app/actions/movements";
import { getEventOptions } from "@/app/actions/events";
import {
  computeCategorizationQuality,
  isPoorlyCategorized,
  isTransferMovement,
} from "@/lib/finance/categorization-quality";
import { getCategorySuggestion } from "@/lib/finance/category-suggestion";
import type { CategoryOption, EventOption, MovementRecord } from "@/lib/finance/types";
import { getBase64ImageFromUrl, registerReportFont, REPORT_FONT } from "@/lib/pdf-utils";
import { formatCLP } from "@/lib/format";

type SortField = "date" | "description" | "type" | "amount";
type SortDirection = "asc" | "desc";

type RecordRow = Omit<MovementRecord, "date"> & { date: Date };

type TypeFilter = "all" | "ingreso" | "egreso" | "transferencia" | "pendiente";

const TYPE_FILTER_CHIPS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "ingreso", label: "Ingresos" },
  { id: "egreso", label: "Egresos" },
  { id: "transferencia", label: "Transferencias" },
  { id: "pendiente", label: "Pendientes" },
];

export default function RecordsPage() {
  return (
    <Suspense fallback={null}>
      <RecordsPageContent />
    </Suspense>
  );
}

function RecordsPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MovementRecord | null>(null);
  const [activeTab, setActiveTab] = useState<"caja_chica" | "fondo_ahorro">("caja_chica");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [defaultModalType, setDefaultModalType] = useState<"Ingreso" | "Egreso">("Ingreso");
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [eventFilter, setEventFilter] = useState<string>("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [isBulkApplying, setIsBulkApplying] = useState(false);
  const [voidTarget, setVoidTarget] = useState<MovementRecord | null>(null);

  const isAdminOrDirectiva = session?.user?.role === "ADMIN" || session?.user?.role === "DIRECTIVA";
  const tableColSpan = isAdminOrDirectiva ? 9 : 7;

  useEffect(() => {
    loadRecords();
    Promise.all([getAllCategoryOptions(), getEventOptions()]).then(([cats, evts]) => {
      setAllCategories(cats);
      setEvents(evts);
    });
  }, []);

  // Filtros iniciales al llegar desde un enlace del dashboard (ej. "Top Ingresos por Categoría").
  useEffect(() => {
    const fund = searchParams.get("fund");
    const category = searchParams.get("category");
    const type = searchParams.get("type");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (fund === "caja_chica" || fund === "fondo_ahorro") setActiveTab(fund);
    if (category) setCategoryFilter(category);
    if (type === "ingreso" || type === "egreso") setTypeFilter(type);
    if (from) setStartDate(from);
    if (to) setEndDate(to);
    if (from || to) setShowDateFilter(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showNewMenu) return;
    const close = () => setShowNewMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showNewMenu]);

  const loadRecords = () => {
    setIsLoading(true);
    fetchMovementsData().then((data) => {
      const parsed = data.map((d) => ({ ...d, date: toCalendarDate(d.date) }));
      setRecords(parsed);
      setIsLoading(false);
    });
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    registerReportFont(doc);
    const filteredRecords = records.filter(r => r.category === activeTab);
    const title = activeTab === "caja_chica" ? "Reporte de Caja Chica" : "Reporte de Fondo de Ahorro";

    try {
      const logoBase64 = await getBase64ImageFromUrl("/logo-cgpa.png");
      doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
    } catch (error) {
      console.error("Could not load logo for PDF", error);
    }

    doc.setFont(REPORT_FONT, "bold");
    doc.setFontSize(18);
    doc.text(title, 40, 22);

    doc.setFontSize(10);
    doc.setFont(REPORT_FONT, "normal");
    doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 40, 28);

    const tableColumn = ["Fecha", "Descripción", "Categoría", "Tipo", "Monto"];
    const tableRows = filteredRecords.map(r => [
      format(r.date, "dd/MM/yyyy"),
      r.description || "Sin descripción",
      r.categoryName || "Sin categoría",
      r.type,
      formatCLP(Math.abs(r.amount)),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { font: REPORT_FONT, fillColor: [99, 102, 241] },
      styles: { font: REPORT_FONT },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const type = data.cell.raw as string;
          if (type === 'Ingreso') {
            data.cell.styles.textColor = [34, 197, 94];
          } else if (type === 'Egreso') {
            data.cell.styles.textColor = [239, 68, 68];
          }
        }
      }
    });

    doc.save(`Reporte_Registros_${format(new Date(), "dd-MM-yyyy")}.pdf`);

    await logReportExport({
      format: "pdf",
      source: "records",
      fund: activeTab,
      recordCount: filteredRecords.length,
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortRecords = (records: any[]) => {
    return [...records].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case "date":
          aVal = a.date.getTime();
          bVal = b.date.getTime();
          break;
        case "description":
          aVal = (a.description || "").toLowerCase();
          bVal = (b.description || "").toLowerCase();
          break;
        case "type":
          aVal = a.type.toLowerCase();
          bVal = b.type.toLowerCase();
          break;
        case "amount":
          aVal = Math.abs(a.amount);
          bVal = Math.abs(b.amount);
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    const result = await voidMovement(voidTarget.id);
    if (result.success) {
      loadRecords();
      toast.success("Movimiento anulado");
      setVoidTarget(null);
    } else {
      toast.error(result.error);
    }
  };

  const handleApplySuggestion = async (
    record: RecordRow,
    categoryId: string,
    categoryName: string
  ) => {
    setApplyingId(record.id);
    const result = await applyCategorySuggestion(record.id, categoryId);
    if (result.success) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id
            ? {
                ...r,
                categoryId,
                categoryName,
                categoryCode: result.record.categoryCode,
              }
            : r
        )
      );
    } else {
      toast.error(result.error);
    }
    setApplyingId(null);
  };

  const openCreate = (type: "Ingreso" | "Egreso" = "Ingreso") => {
    setDefaultModalType(type);
    setEditingRecord(null);
    setIsModalOpen(true);
    setShowNewMenu(false);
  };

  const matchesTypeFilter = (record: RecordRow) => {
    switch (typeFilter) {
      case "ingreso":
        return record.type === "Ingreso" && !isTransferMovement(record);
      case "egreso":
        return record.type === "Egreso" && !isTransferMovement(record);
      case "transferencia":
        return isTransferMovement(record);
      case "pendiente":
        return isPoorlyCategorized(record);
      default:
        return true;
    }
  };

  const openEdit = (record: RecordRow) => {
    setEditingRecord({ ...record, date: record.date.toISOString() });
    setIsModalOpen(true);
  };

  const tabRecords = useMemo(
    () => records.filter((r) => r.category === activeTab),
    [records, activeTab]
  );

  const displayedRecords = sortRecords(
    tabRecords
      .filter(matchesTypeFilter)
      .filter(r => {
        if (categoryFilter && r.categoryId !== categoryFilter) return false;
        if (eventFilter === "__none__" && r.eventId) return false;
        if (eventFilter && eventFilter !== "__none__" && r.eventId !== eventFilter) return false;
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matches =
            r.description.toLowerCase().includes(q) ||
            r.type.toLowerCase().includes(q) ||
            (r.categoryName?.toLowerCase().includes(q) ?? false) ||
            (r.eventName?.toLowerCase().includes(q) ?? false);
          if (!matches) return false;
        }
        if (startDate || endDate) {
          const recordDate = format(r.date, "yyyy-MM-dd");
          if (startDate && recordDate < startDate) return false;
          if (endDate && recordDate > endDate) return false;
        }
        return true;
      })
  );

  const totalIngresos = displayedRecords
    .filter(r => r.type === "Ingreso")
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);
  
  const totalEgresos = displayedRecords
    .filter(r => r.type === "Egreso")
    .reduce((acc, r) => acc + Math.abs(r.amount), 0);

  const categorization = useMemo(
    () => computeCategorizationQuality(tabRecords),
    [tabRecords]
  );

  const suggestionMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCategorySuggestion>>();
    for (const record of tabRecords) {
      const suggestion = getCategorySuggestion(record, allCategories);
      if (suggestion) map.set(record.id, suggestion);
    }
    return map;
  }, [tabRecords, allCategories]);

  const suggestionCount = suggestionMap.size;

  const selectableRecords = useMemo(
    () => displayedRecords.filter((r) => !r.transferId),
    [displayedRecords]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableRecords.length && selectableRecords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableRecords.map((r) => r.id)));
    }
  };

  const handleBulkApply = async () => {
    if (!bulkCategoryId || selectedIds.size === 0) return;

    setIsBulkApplying(true);
    const result = await applyBulkCategorySuggestion(Array.from(selectedIds), bulkCategoryId);
    if (result.success) {
      setRecords((prev) => {
        const updatedMap = new Map(result.records.map((r) => [r.id, r]));
        return prev.map((r) => {
          const updated = updatedMap.get(r.id);
          return updated ? { ...r, ...updated, date: toCalendarDate(updated.date) } : r;
        });
      });
      setSelectedIds(new Set());
      setBulkCategoryId("");
      toast.success("Categoría actualizada");
    } else {
      toast.error(result.error);
    }
    setIsBulkApplying(false);
  };

  const bulkTypeMismatch = useMemo(() => {
    if (selectedIds.size === 0) return false;
    const selected = displayedRecords.filter((r) => selectedIds.has(r.id));
    const types = new Set(selected.map((r) => r.type));
    return types.size > 1;
  }, [selectedIds, displayedRecords]);

  const bulkCategories = useMemo(() => {
    if (selectedIds.size === 0) return allCategories;
    const selected = displayedRecords.filter((r) => selectedIds.has(r.id));
    const type = selected[0]?.type;
    if (!type || bulkTypeMismatch) return [];
    const catType = type === "Ingreso" ? "INCOME" : "EXPENSE";
    return allCategories.filter((c) => c.type === catType);
  }, [selectedIds, displayedRecords, allCategories, bulkTypeMismatch]);

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    setShowDateFilter(false);
  };

  return (
    <div className="flex flex-col md:h-full md:min-h-0">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Registros</h1>
          <p className="text-muted text-sm md:text-base">Administra todos los ingresos y egresos de tu base de datos.</p>
        </div>
        
        {isAdminOrDirectiva && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <div className="flex">
                <button
                  onClick={() => openCreate(defaultModalType)}
                  className="btn-primary flex items-center justify-center gap-2 shadow-lg flex-1 md:flex-none rounded-r-none border-r border-white/10"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Movimiento</span>
                  <span className="sm:hidden">+</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewMenu((v) => !v);
                  }}
                  className="btn-primary px-2.5 rounded-l-none shadow-lg"
                  aria-label="Más opciones de movimiento"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              {showNewMenu && (
                <div
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-30 min-w-[180px] glass-panel shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openCreate("Ingreso")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-elevated flex items-center gap-2 text-income"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Nuevo ingreso
                  </button>
                  <button
                    onClick={() => openCreate("Egreso")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-surface-elevated flex items-center gap-2 text-expense"
                  >
                    <ArrowDownRight className="w-4 h-4" />
                    Nuevo gasto
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleExportPDF}
              className="btn-secondary flex items-center justify-center gap-2 flex-1 md:flex-none"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        )}
      </div>

      {/* Pendientes de revisión */}
      {!isLoading && categorization.poorQualityCount > 0 && (
        <div className="glass-panel p-4 md:p-5 mb-6 border border-info/20 bg-info/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-info/10 border border-info/20 flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="font-semibold text-sm md:text-base">
                Pendientes de revisión: {categorization.poorQualityCount}{" "}
                {categorization.poorQualityCount === 1 ? "movimiento" : "movimientos"}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-muted text-xs md:text-sm mt-1">
                {categorization.uncategorizedCount > 0 && (
                  <span>Sin categoría: {categorization.uncategorizedCount}</span>
                )}
                {categorization.otrosGastosCount > 0 && (
                  <span>Otros gastos: {categorization.otrosGastosCount}</span>
                )}
                {categorization.otrosIngresosCount > 0 && (
                  <span>Otros ingresos: {categorization.otrosIngresosCount}</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setTypeFilter("pendiente");
              setCategoryFilter("");
            }}
            className={`btn-primary text-sm whitespace-nowrap w-full sm:w-auto ${
              typeFilter === "pendiente" ? "ring-2 ring-info/50" : ""
            }`}
          >
            Revisar ahora
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab("caja_chica")}
          className={`pb-3 px-2 text-sm font-medium transition-colors relative ${activeTab === "caja_chica" ? "text-primary" : "text-muted hover:text-foreground"}`}
        >
          Caja Chica
          {activeTab === "caja_chica" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("fondo_ahorro")}
          className={`pb-3 px-2 text-sm font-medium transition-colors relative ${activeTab === "fondo_ahorro" ? "text-info" : "text-muted hover:text-foreground"}`}
        >
          Fondo de Ahorro
          {activeTab === "fondo_ahorro" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-info rounded-t-full" />
          )}
        </button>
      </div>

      {/* Chips de filtro rápido */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {TYPE_FILTER_CHIPS.map((chip) => (
          <button
            key={chip.id}
            onClick={() => setTypeFilter(chip.id)}
            className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors border flex-shrink-0 whitespace-nowrap ${
              typeFilter === chip.id
                ? "bg-primary/20 text-primary border-primary/40"
                : "bg-surface-elevated text-muted border-border hover:bg-border/40 hover:text-foreground"
            }`}
          >
            {chip.label}
            {chip.id === "pendiente" && categorization.poorQualityCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-info/20 text-info text-xs font-bold">
                {categorization.poorQualityCount}
              </span>
            )}
            {chip.id === "transferencia" && categorization.transferCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-surface-elevated text-muted text-xs">
                {categorization.transferCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="glass-panel p-4 mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Buscar por descripción o tipo..." 
              className="input-premium pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="select-premium text-sm w-full sm:flex-1 lg:min-w-[160px]"
            >
              <option value="">Todas las categorías</option>
              {allCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="select-premium text-sm w-full sm:flex-1 lg:min-w-[160px]"
            >
              <option value="">Todas las actividades</option>
              <option value="__none__">Sin actividad</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className={`btn-secondary flex w-full sm:w-auto items-center justify-center gap-2 text-xs sm:text-sm whitespace-nowrap ${showDateFilter ? "bg-primary/20" : ""}`}
            >
              <Filter className="w-4 h-4" />
              <span>Fecha</span>
            </button>
          </div>
        </div>

        {/* Filtro de fechas */}
        {showDateFilter && (
          <div className="flex flex-col md:flex-row items-center gap-4 pt-4 border-t border-border">
            <div className="flex-1 w-full md:w-auto">
              <label className="text-xs text-muted mb-1 block">Fecha desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-premium"
              />
            </div>
            <div className="flex-1 w-full md:w-auto">
              <label className="text-xs text-muted mb-1 block">Fecha hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-premium"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={clearDateFilter}
                className="btn-secondary text-xs px-3 py-2"
              >
                Limpiar
              </button>
            )}
          </div>
        )}

        {/* Resumen de ingresos/egresos y calidad de datos */}
        {displayedRecords.length > 0 && (
          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted">Total Ingresos:</span>
                <span className="text-income font-semibold tabular-nums">{formatCLP(totalIngresos)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted">Total Egresos:</span>
                <span className="text-expense font-semibold tabular-nums">{formatCLP(totalEgresos)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted">Saldo:</span>
                <span
                  className={`font-semibold tabular-nums ${
                    totalIngresos - totalEgresos >= 0 ? "text-income" : "text-expense"
                  }`}
                >
                  {formatCLP(totalIngresos - totalEgresos)}
                </span>
              </div>
            </div>

            {typeFilter === "pendiente" && (
              <div className="flex flex-col gap-1 text-xs text-info px-1">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Mostrando movimientos sin categoría o en &quot;Otros&quot;. Las transferencias no
                    aparecen aquí.
                  </span>
                </div>
                {suggestionCount > 0 && isAdminOrDirectiva && (
                  <span className="text-muted pl-5">
                    {suggestionCount}{" "}
                    {suggestionCount === 1 ? "tiene" : "tienen"} categoría sugerida — usa el botón ✓ para
                    aplicar.
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {isAdminOrDirectiva && selectedIds.size > 0 && (
        <div className="glass-panel p-4 mb-4 border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? "movimiento seleccionado" : "movimientos seleccionados"}
          </p>
          {bulkTypeMismatch ? (
            <p className="text-xs text-info">Selecciona movimientos del mismo tipo (ingreso o egreso).</p>
          ) : (
            <>
              <select
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
                className="select-premium text-sm flex-1 sm:max-w-xs"
              >
                <option value="">Elegir categoría...</option>
                {bulkCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkApply}
                disabled={!bulkCategoryId || isBulkApplying}
                className="btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBulkApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Aplicar categoría
              </button>
            </>
          )}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="btn-secondary text-sm sm:ml-auto"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Tabla responsive — scroll horizontal en móvil */}
      <div className="glass-panel flex flex-col md:flex-1 md:min-h-0 overflow-hidden">
        <p className="md:hidden px-3 pt-3 text-xs text-muted">
          Desliza horizontalmente para ver todas las columnas
        </p>
        <div className="overflow-x-auto md:flex-1 custom-scrollbar">
          <table className="w-full min-w-[640px] text-xs md:text-sm text-left border-collapse">
            <thead className="text-xs uppercase table-head text-muted">
              <tr>
                {isAdminOrDirectiva && (
                  <th className="px-2 md:px-4 py-3 md:py-4 font-semibold text-foreground/80 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectableRecords.length > 0 &&
                        selectedIds.size === selectableRecords.length
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-border bg-surface"
                      title="Seleccionar todos"
                    />
                  </th>
                )}
                <th 
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-foreground/80 cursor-pointer hover:bg-surface-elevated transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    Fecha
                    {sortField === "date" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-foreground/80 cursor-pointer hover:bg-surface-elevated transition-colors"
                  onClick={() => handleSort("description")}
                >
                  <div className="flex items-center gap-1">
                    Desc.
                    {sortField === "description" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-foreground/80 cursor-pointer hover:bg-surface-elevated transition-colors"
                  onClick={() => handleSort("type")}
                >
                  <div className="flex items-center gap-1">
                    Tipo
                    {sortField === "type" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-foreground/80 cursor-pointer hover:bg-surface-elevated transition-colors"
                  onClick={() => handleSort("amount")}
                >
                  <div className="flex items-center gap-1">
                    Monto
                    {sortField === "amount" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-foreground/80">
                  Categoría
                </th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-foreground/80 hidden lg:table-cell">
                  Actividad
                </th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-foreground/80 hidden lg:table-cell">
                  Sugerencia
                </th>
                {isAdminOrDirectiva && (
                  <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-foreground/80 text-right">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-center py-8 text-muted text-sm">
                    Cargando movimientos...
                  </td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-muted text-base md:text-lg">No se encontraron registros</p>
                      {(searchTerm ||
                        startDate ||
                        endDate ||
                        categoryFilter ||
                        eventFilter ||
                        typeFilter !== "all") && (
                        <p className="text-muted text-xs md:text-sm">
                          Intenta ajustar los filtros de búsqueda o fecha
                        </p>
                      )}
                      {typeFilter === "pendiente" && categorization.poorQualityCount === 0 && (
                        <p className="text-income text-xs md:text-sm">
                          No hay movimientos pendientes de categorizar en este fondo.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((record) => {
                  const suggestion = suggestionMap.get(record.id);
                  return (
                  <tr key={record.id} className="hover:bg-surface-elevated transition-colors group">
                    {isAdminOrDirectiva && (
                      <td className="px-2 md:px-4 py-3 md:py-4">
                        {!record.transferId ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record.id)}
                            onChange={() => toggleSelect(record.id)}
                            className="rounded border-border bg-surface"
                          />
                        ) : null}
                      </td>
                    )}
                    <td className="px-2 md:px-6 py-3 md:py-4 whitespace-nowrap text-foreground/80 text-xs md:text-sm">
                      <span className="md:hidden">{format(record.date, "dd/MM/yy")}</span>
                      <span className="hidden md:inline">{format(record.date, "dd MMM, yyyy", { locale: es })}</span>
                    </td>
                    <td className="px-2 md:px-6 py-3 md:py-4 font-medium max-w-[200px] lg:max-w-xs">
                      <span className="truncate block text-sm" title={record.description}>
                        {record.description || "—"}
                      </span>
                    </td>
                    <td className="px-2 md:px-6 py-3 md:py-4">
                      <span className={`inline-flex items-center px-1.5 md:px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap
                        ${record.type === 'Ingreso' ? 'bg-income/10 text-income border-income/20' : 'bg-expense/10 text-expense border-expense/20'}`}>
                        {record.type}
                      </span>
                    </td>
                    <td className={`px-2 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm tabular-nums ${record.amount < 0 ? 'text-expense' : record.type === 'Ingreso' ? 'text-income' : ''}`}>
                      <span className="whitespace-nowrap">
                        {record.amount < 0 ? '-' : ''}{formatCLP(Math.abs(record.amount))}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      {record.transferId ? (
                        <span className="text-muted text-xs md:text-xs">Transferencia</span>
                      ) : record.categoryName ? (
                        <span
                          className={`px-1.5 md:px-2 py-0.5 rounded text-xs md:text-xs whitespace-nowrap ${
                            isPoorlyCategorized(record)
                              ? "bg-info/10 text-info border border-info/20"
                              : "bg-surface-elevated text-muted"
                          }`}
                        >
                          {record.categoryName}
                        </span>
                      ) : (
                        <span className="text-info text-xs md:text-xs">Sin categoría</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      {record.eventId && record.eventName ? (
                        <Link
                          href={`/events/${record.eventId}`}
                          className="text-xs md:text-xs text-primary hover:underline flex items-center gap-1 max-w-[140px]"
                          title={record.eventName}
                        >
                          <PartyPopper className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{record.eventName}</span>
                        </Link>
                      ) : (
                        <span className="text-muted text-xs md:text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      {suggestion ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs md:text-xs text-income font-medium truncate max-w-[100px]">
                            {suggestion.categoryName}
                          </span>
                          {isAdminOrDirectiva && !record.transferId && (
                            <button
                              onClick={() =>
                                handleApplySuggestion(
                                  record,
                                  suggestion.categoryId,
                                  suggestion.categoryName
                                )
                              }
                              disabled={applyingId === record.id}
                              className="p-1 rounded-md bg-income/10 text-income hover:bg-income/20 border border-income/20 disabled:opacity-50"
                              title={`Aplicar ${suggestion.categoryName}`}
                            >
                              {applyingId === record.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted text-xs md:text-xs">—</span>
                      )}
                    </td>
                    {isAdminOrDirectiva && (
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                        {!record.transferId ? (
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100">
                            <button
                              onClick={() => openEdit(record)}
                              className="p-1.5 rounded-lg hover:bg-surface-elevated text-muted hover:text-primary"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setVoidTarget(record)}
                              className="p-1.5 rounded-lg hover:bg-surface-elevated text-muted hover:text-expense"
                              title="Anular"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">Transferencia</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="border-t border-border p-3 md:p-4 text-xs md:text-sm text-muted bg-surface-elevated">
          Mostrando {displayedRecords.length} registros
        </div>
      </div>
      <RecordModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingRecord(null); }}
        onSaved={loadRecords}
        record={editingRecord}
        defaultFund={activeTab}
        defaultType={defaultModalType}
      />
      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={handleVoid}
        title="¿Anular este movimiento?"
        description={`Dejará de contar en los saldos. "${voidTarget?.description ?? ""}" quedará registrado en la auditoría.`}
        confirmLabel="Anular movimiento"
      />
    </div>
  );
}
