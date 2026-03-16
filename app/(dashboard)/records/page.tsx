"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Edit, Trash2, ArrowUp, ArrowDown, ChevronUp, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { RecordModal } from "@/components/ui/RecordModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchRecordsData } from "@/app/actions/sheets";

type SortField = "date" | "description" | "type" | "amount";
type SortDirection = "asc" | "desc";

export default function RecordsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"caja_chica" | "fondo_ahorro">("caja_chica");
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    fetchRecordsData().then(data => {
      const parsed = data.map(d => ({ ...d, date: new Date(d.date) }));
      setRecords(parsed);
      setIsLoading(false);
    });
  }, []);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const filteredRecords = records.filter(r => r.category === activeTab);
    const title = activeTab === "caja_chica" ? "Reporte de Caja Chica" : "Reporte de Fondo de Ahorro";
    
    doc.setFont("helvetica", "bold");
    doc.text(title, 14, 20);
    
    const tableColumn = ["Fecha", "Descripción", "Tipo", "Monto", "Estado"];
    const tableRows = filteredRecords.map(r => [
      format(r.date, "dd/MM/yyyy"), 
      r.description, 
      r.type, 
      `$${r.amount.toLocaleString('es-CL')}`, 
      r.status === 'COMPLETED' ? 'Completado' : 'Pendiente'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] } 
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

  const displayedRecords = sortRecords(
    records
      .filter(r => r.category === activeTab)
      .filter(r => {
        // Filtro de búsqueda
        if (searchTerm && !r.description.toLowerCase().includes(searchTerm.toLowerCase()) && 
            !r.type.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        // Filtro de fechas
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
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button onClick={handleExportPDF} className="btn-secondary flex items-center justify-center gap-2 flex-1 md:flex-none">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center justify-center gap-2 shadow-lg flex-1 md:flex-none">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo</span><span className="sm:hidden">+</span>
          </button>
        </div>
      </div>

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
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              onClick={() => setShowDateFilter(!showDateFilter)}
              className={`btn-secondary flex flex-1 md:flex-none items-center justify-center gap-2 ${showDateFilter ? 'bg-primary/20' : ''}`}
            >
              <Filter className="w-4 h-4" /> Filtros de Fecha
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

        {/* Resumen de ingresos/egresos */}
        {displayedRecords.length > 0 && (
          <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-white/60">Total Ingresos:</span>
              <span className="text-success font-semibold">${totalIngresos.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/60">Total Egresos:</span>
              <span className="text-danger font-semibold">${totalEgresos.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/60">Saldo:</span>
              <span className={`font-semibold ${totalIngresos - totalEgresos >= 0 ? 'text-success' : 'text-danger'}`}>
                ${(totalIngresos - totalEgresos).toLocaleString('es-CL')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Data Grid */}
      <div className="glass-panel flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-xs md:text-sm text-left min-w-[800px]">
            <thead className="text-[10px] md:text-xs uppercase bg-white/5 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th 
                  className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1 md:gap-2">
                    Fecha
                    {sortField === "date" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => handleSort("description")}
                >
                  <div className="flex items-center gap-1 md:gap-2">
                    Descripción
                    {sortField === "description" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => handleSort("type")}
                >
                  <div className="flex items-center gap-1 md:gap-2">
                    Tipo
                    {sortField === "type" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                    )}
                  </div>
                </th>
                <th 
                  className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => handleSort("amount")}
                >
                  <div className="flex items-center gap-1 md:gap-2">
                    Monto
                    {sortField === "amount" && (
                      sortDirection === "asc" ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                    )}
                  </div>
                </th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 hidden lg:table-cell">Estado</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 hidden xl:table-cell">Etiquetas</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-semibold text-white/80 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-white/50 text-sm">Cargando datos remotos de Google Sheets...</td>
                </tr>
              ) : displayedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-white/50 text-base md:text-lg">No se encontraron registros</p>
                      {(searchTerm || startDate || endDate) && (
                        <p className="text-white/40 text-xs md:text-sm">
                          Intenta ajustar los filtros de búsqueda o fecha
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-3 md:px-6 py-3 md:py-4 whitespace-nowrap text-white/80 text-xs md:text-sm">
                      <span className="md:hidden">{format(record.date, "dd/MM/yy", { locale: es })}</span>
                      <span className="hidden md:inline">{format(record.date, "dd MMM, yyyy", { locale: es })}</span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 font-medium max-w-[150px] md:max-w-none">
                      <span className="truncate block" title={record.description}>
                        {record.description || "Sin descripción"}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className={`inline-flex items-center px-1.5 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium border
                        ${record.type === 'Ingreso' ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
                        {record.type === 'Ingreso' ? 'Ing' : 'Egr'}
                        <span className="hidden sm:inline ml-1">{record.type === 'Ingreso' ? 'reso' : 'eso'}</span>
                      </span>
                    </td>
                    <td className={`px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm ${record.amount < 0 ? 'text-danger' : record.type === 'Ingreso' ? 'text-success' : ''}`}>
                      {record.amount < 0 ? '-' : ''}${Math.abs(record.amount).toLocaleString('es-CL')}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden lg:table-cell">
                      <span className={`inline-flex items-center px-1.5 md:px-2.5 py-0.5 rounded-full text-[10px] md:text-xs font-medium border
                        ${record.status === 'COMPLETED' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-warning/10 text-warning border-warning/20'}`}>
                        {record.status === 'COMPLETED' ? 'Completado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 hidden xl:table-cell">
                      <div className="flex gap-1 flex-wrap">
                        {JSON.parse(record.tags).map((tag: string, i: number) => (
                          <span key={i} className="px-1.5 md:px-2 py-0.5 bg-white/10 rounded text-[9px] md:text-[10px] text-white/70">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right">
                      <div className="flex items-center justify-end gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button className="p-1 md:p-1.5 hover:bg-white/10 rounded-md text-white/60 hover:text-white transition-colors" title="Editar">
                          <Edit className="w-3 h-3 md:w-4 md:h-4" />
                        </button>
                        <button className="p-1 md:p-1.5 hover:bg-danger/20 rounded-md text-white/60 hover:text-danger transition-colors" title="Eliminar">
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="border-t border-white/10 p-4 flex items-center justify-between text-sm text-white/60 bg-white/5">
          <div>Mostrando {displayedRecords.length} registros</div>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-1 text-xs" disabled>Anterior</button>
            <button className="btn-secondary px-3 py-1 text-xs" disabled>Siguiente</button>
          </div>
        </div>
      </div>
      <RecordModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
