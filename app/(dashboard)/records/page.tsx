"use client";

import { useState, useEffect, useMemo } from "react";
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
import { RecordModal } from "@/components/ui/RecordModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  applyCategorySuggestion,
  fetchMovementsData,
  getAllCategoryOptions,
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
import { getBase64ImageFromUrl } from "@/lib/pdf-utils";

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
  const { data: session } = useSession();
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

  const isAdminOrDirectiva = session?.user?.role === "ADMIN" || session?.user?.role === "DIRECTIVA";
  const tableColSpan = isAdminOrDirectiva ? 8 : 7;

  useEffect(() => {
    loadRecords();
    Promise.all([getAllCategoryOptions(), getEventOptions()]).then(([cats, evts]) => {
      setAllCategories(cats);
      setEvents(evts);
    });
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
      const parsed = data.map((d) => ({ ...d, date: new Date(d.date) }));
      setRecords(parsed);
      setIsLoading(false);
    });
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const filteredRecords = records.filter(r => r.category === activeTab);
    const title = activeTab === "caja_chica" ? "Reporte de Caja Chica" : "Reporte de Fondo de Ahorro";
    
    try {
      const logoBase64 = await getBase64ImageFromUrl("/logo-cgpa.png");
      doc.addImage(logoBase64, "PNG", 14, 10, 20, 20);
    } catch (error) {
      console.error("Could not load logo for PDF", error);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, 40, 22);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generado el: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 40, 28);
    
    const tableColumn = ["Fecha", "Descripción", "Categoría", "Tipo", "Monto"];
    const tableRows = filteredRecords.map(r => [
      format(r.date, "dd/MM/yyyy"),
      r.description,
      r.categoryName || "Sin categoría",
      r.type,
      `$${Math.abs(r.amount).toLocaleString('es-CL')}`,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
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

  const handleVoid = async (record: MovementRecord) => {
    if (!confirm(`¿Anular el movimiento "${record.description}"?`)) return;
    const result = await voidMovement(record.id);
    if (result.success) loadRecords();
    else alert(result.error);
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
      alert(result.error);
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

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    setShowDateFilter(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestión de Registros</h1>
          <p className="text-white/60 text-sm md:text-base">Administra todos los ingresos y egresos de tu base de datos.</p>
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
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-30 min-w-[180px] glass-panel border border-white/10 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openCreate("Ingreso")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 flex items-center gap-2 text-success"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Nuevo ingreso
                  </button>
                  <button
                    onClick={() => openCreate("Egreso")}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 flex items-center gap-2 text-danger"
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
        <div className="glass-panel p-4 md:p-5 mb-6 border border-accent/20 bg-accent/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 flex-shrink-0">
              <ClipboardList className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-sm md:text-base">
                Pendientes de revisión: {categorization.poorQualityCount}{" "}
                {categorization.poorQualityCount === 1 ? "movimiento" : "movimientos"}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-white/60 text-xs md:text-sm mt-1">
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
              typeFilter === "pendiente" ? "ring-2 ring-accent/50" : ""
            }`}
          >
            Revisar ahora
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-white/10 pb-1">
        <button 
          onClick={() => setActiveTab("caja_chica")}
          className={`pb-3 px-2 text-sm font-medium transition-colors relative ${activeTab === "caja_chica" ? "text-primary" : "text-white/50 hover:text-white/80"}`}
        >
          Caja Chica
          {activeTab === "caja_chica" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab("fondo_ahorro")}
          className={`pb-3 px-2 text-sm font-medium transition-colors relative ${activeTab === "fondo_ahorro" ? "text-accent" : "text-white/50 hover:text-white/80"}`}
        >
          Fondo de Ahorro
          {activeTab === "fondo_ahorro" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent rounded-t-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
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
                : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white/80"
            }`}
          >
            {chip.label}
            {chip.id === "pendiente" && categorization.poorQualityCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold">
                {categorization.poorQualityCount}
              </span>
            )}
            {chip.id === "transferencia" && categorization.transferCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-[10px]">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
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
          <div className="flex flex-col md:flex-row items-center gap-4 pt-4 border-t border-white/10">
            <div className="flex-1 w-full md:w-auto">
              <label className="text-xs text-white/60 mb-1 block">Fecha desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-premium"
              />
            </div>
            <div className="flex-1 w-full md:w-auto">
              <label className="text-xs text-white/60 mb-1 block">Fecha hasta</label>
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
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-white/60">Total Ingresos:</span>
                <span className="text-success font-semibold">${totalIngresos.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60">Total Egresos:</span>
                <span className="text-danger font-semibold">${totalEgresos.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/60">Saldo:</span>
                <span
                  className={`font-semibold ${
                    totalIngresos - totalEgresos >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  ${(totalIngresos - totalEgresos).toLocaleString("es-CL")}
                </span>
              </div>
            </div>

            {typeFilter === "pendiente" && (
              <div className="flex flex-col gap-1 text-xs text-accent px-1">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Mostrando movimientos sin categoría o en &quot;Otros&quot;. Las transferencias no
                    aparecen aquí.
                  </span>
                </div>
                {suggestionCount > 0 && isAdminOrDirectiva && (
                  <span className="text-white/50 pl-5">
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

      {/* Vista móvil — tarjetas */}
      <div className="glass-panel flex-1 flex flex-col overflow-hidden md:hidden">
        {isLoading ? (
          <p className="text-center py-8 text-white/50 text-sm">Cargando movimientos...</p>
        ) : displayedRecords.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-white/50 text-base">No se encontraron registros</p>
            {(searchTerm ||
              startDate ||
              endDate ||
              categoryFilter ||
              eventFilter ||
              typeFilter !== "all") && (
              <p className="text-white/40 text-xs mt-2">Intenta ajustar los filtros</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5 overflow-y-auto flex-1 custom-scrollbar">
            {displayedRecords.map((record) => {
              const suggestion = suggestionMap.get(record.id);
              return (
                <div key={record.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-white leading-snug">
                        {record.description || "Sin descripción"}
                      </p>
                      <p className="text-white/50 text-xs mt-1">
                        {format(record.date, "dd MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          record.type === "Ingreso"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-danger/10 text-danger border-danger/20"
                        }`}
                      >
                        {record.type}
                      </span>
                      <span
                        className={`font-semibold text-sm whitespace-nowrap ${
                          record.type === "Ingreso" ? "text-success" : "text-white"
                        }`}
                      >
                        {record.type === "Ingreso" ? "+" : "-"}$
                        {Math.abs(record.amount).toLocaleString("es-CL")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {record.transferId ? (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-white/50">Transferencia</span>
                    ) : record.categoryName ? (
                      <span
                        className={`px-2 py-0.5 rounded ${
                          isPoorlyCategorized(record)
                            ? "bg-accent/10 text-accent border border-accent/20"
                            : "bg-white/10 text-white/70"
                        }`}
                      >
                        {record.categoryName}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-accent/10 text-accent">Sin categoría</span>
                    )}
                    {suggestion && (
                      <span className="px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 flex items-center gap-1">
                        → {suggestion.categoryName}
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
                            className="p-0.5 rounded bg-success/20 disabled:opacity-50"
                            title={`Aplicar ${suggestion.categoryName}`}
                          >
                            {applyingId === record.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </span>
                    )}
                    {record.eventName && record.eventId && (
                      <Link
                        href={`/events/${record.eventId}`}
                        className="px-2 py-0.5 rounded bg-primary/10 text-primary flex items-center gap-1"
                      >
                        <PartyPopper className="w-3 h-3" />
                        {record.eventName}
                      </Link>
                    )}
                  </div>

                  {isAdminOrDirectiva && !record.transferId && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => openEdit(record)}
                        className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      <button
                        onClick={() => handleVoid(record)}
                        className="btn-secondary flex-1 text-xs py-2 flex items-center justify-center gap-1.5 text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Anular
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="border-t border-white/10 p-3 text-xs text-white/60 bg-white/5">
          Mostrando {displayedRecords.length} registros
        </div>
      </div>

      {/* Vista desktop — tabla */}
      <div className="glass-panel flex-1 flex-col overflow-hidden hidden md:flex">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full min-w-[720px] text-sm text-left border-collapse">
            <thead className="text-xs uppercase bg-[#0f1115] border-b border-white/10 sticky top-0 z-10">
              <tr>
                <th 
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
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
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
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
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
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
                  className="px-2 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => handleSort("amount")}
                >
                  <div className="flex items-center gap-1">
                    Monto
                    {sortField === "amount" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 hidden lg:table-cell">
                  Categoría
                </th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 hidden lg:table-cell">
                  Actividad
                </th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 hidden lg:table-cell">
                  Sugerencia
                </th>
                {isAdminOrDirectiva && (
                  <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 text-right">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-center py-8 text-white/50 text-sm">
                    Cargando movimientos...
                  </td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-white/50 text-base md:text-lg">No se encontraron registros</p>
                      {(searchTerm ||
                        startDate ||
                        endDate ||
                        categoryFilter ||
                        eventFilter ||
                        typeFilter !== "all") && (
                        <p className="text-white/40 text-xs md:text-sm">
                          Intenta ajustar los filtros de búsqueda o fecha
                        </p>
                      )}
                      {typeFilter === "pendiente" && categorization.poorQualityCount === 0 && (
                        <p className="text-success text-xs md:text-sm">
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
                  <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-2 md:px-6 py-3 md:py-4 whitespace-nowrap text-white/80 text-[10px] md:text-sm">
                      <span className="md:hidden">{format(record.date, "dd/MM/yy")}</span>
                      <span className="hidden md:inline">{format(record.date, "dd MMM, yyyy", { locale: es })}</span>
                    </td>
                    <td className="px-2 md:px-6 py-3 md:py-4 font-medium max-w-[200px] lg:max-w-xs">
                      <span className="truncate block text-sm" title={record.description}>
                        {record.description || "—"}
                      </span>
                    </td>
                    <td className="px-2 md:px-6 py-3 md:py-4">
                      <span className={`inline-flex items-center px-1.5 md:px-2.5 py-0.5 rounded-full text-[9px] md:text-xs font-medium border whitespace-nowrap
                        ${record.type === 'Ingreso' ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
                        {record.type}
                      </span>
                    </td>
                    <td className={`px-2 md:px-6 py-3 md:py-4 font-semibold text-[10px] md:text-sm ${record.amount < 0 ? 'text-danger' : record.type === 'Ingreso' ? 'text-success' : ''}`}>
                      <span className="whitespace-nowrap">
                        {record.amount < 0 ? '-' : ''}${Math.abs(record.amount).toLocaleString('es-CL')}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      {record.transferId ? (
                        <span className="text-white/40 text-[9px] md:text-[10px]">Transferencia</span>
                      ) : record.categoryName ? (
                        <span
                          className={`px-1.5 md:px-2 py-0.5 rounded text-[9px] md:text-[10px] ${
                            isPoorlyCategorized(record)
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : "bg-white/10 text-white/70"
                          }`}
                        >
                          {record.categoryName}
                        </span>
                      ) : (
                        <span className="text-accent text-[9px] md:text-[10px]">Sin categoría</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      {record.eventId && record.eventName ? (
                        <Link
                          href={`/events/${record.eventId}`}
                          className="text-[9px] md:text-[10px] text-primary hover:underline flex items-center gap-1 max-w-[140px]"
                          title={record.eventName}
                        >
                          <PartyPopper className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{record.eventName}</span>
                        </Link>
                      ) : (
                        <span className="text-white/30 text-[9px] md:text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      {suggestion ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] md:text-[10px] text-success font-medium truncate max-w-[100px]">
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
                              className="p-1 rounded-md bg-success/10 text-success hover:bg-success/20 border border-success/20 disabled:opacity-50"
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
                        <span className="text-white/20 text-[9px] md:text-[10px]">—</span>
                      )}
                    </td>
                    {isAdminOrDirectiva && (
                      <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                        {!record.transferId ? (
                          <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100">
                            <button
                              onClick={() => openEdit(record)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-primary"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleVoid(record)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-danger"
                              title="Anular"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/30">Transferencia</span>
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
        
        <div className="border-t border-white/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-white/60 bg-white/5">
          <div>Mostrando {displayedRecords.length} registros</div>
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
    </div>
  );
}
