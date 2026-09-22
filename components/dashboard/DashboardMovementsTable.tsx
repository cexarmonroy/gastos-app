"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { fetchMovementsData, countMovements } from "@/app/actions/movements";
import { getAllCategoryOptions } from "@/app/actions/movements";
import { getEventOptions } from "@/app/actions/events";
import { formatCalendarDate } from "@/lib/date-only";
import { es } from "date-fns/locale";
import type { CategoryOption, EventOption, FundTab, MovementRecord } from "@/lib/finance/types";

const PAGE_SIZE = 10;

export function DashboardMovementsTable() {
  const [records, setRecords] = useState<MovementRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [fundTab, setFundTab] = useState<FundTab | "">("");
  const [type, setType] = useState<"Ingreso" | "Egreso" | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [eventId, setEventId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);

  useEffect(() => {
    Promise.all([getAllCategoryOptions(), getEventOptions()]).then(([cats, evts]) => {
      setCategories(cats);
      setEvents(evts);
    });
  }, []);

  // Debounce del buscador para no disparar una consulta por cada tecla.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    const filters = {
      fundTab: fundTab || undefined,
      type: type || undefined,
      categoryId: categoryId || undefined,
      eventId: eventId || undefined,
      search: search || undefined,
    };
    Promise.all([
      fetchMovementsData({ ...filters, take: PAGE_SIZE, skip: page * PAGE_SIZE }),
      countMovements(filters),
    ])
      .then(([data, count]) => {
        if (cancelled) return;
        setRecords(data);
        setTotal(count);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fundTab, type, categoryId, eventId, search, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const formatM = (val: number) =>
    "$" + Math.abs(val).toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  function resetPageAnd<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  return (
    <div className="glass-panel p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg md:text-xl font-semibold">Registro de Movimientos</h3>
          <p className="text-muted text-xs mt-0.5">Libro auxiliar con respaldo documental digital</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por descripción..."
            className="input-premium pl-10 py-2 text-sm"
          />
        </div>
        <select
          value={fundTab}
          onChange={(e) => resetPageAnd(setFundTab)(e.target.value as FundTab | "")}
          className="select-premium py-2 text-sm w-full sm:w-auto"
        >
          <option value="">Todos los fondos</option>
          <option value="caja_chica">Caja Chica</option>
          <option value="fondo_ahorro">Fondo de Ahorro</option>
        </select>
        <select
          value={type}
          onChange={(e) => resetPageAnd(setType)(e.target.value as "Ingreso" | "Egreso" | "")}
          className="select-premium py-2 text-sm w-full sm:w-auto"
        >
          <option value="">Todos los tipos</option>
          <option value="Ingreso">Ingreso</option>
          <option value="Egreso">Egreso</option>
        </select>
        <select
          value={categoryId}
          onChange={(e) => resetPageAnd(setCategoryId)(e.target.value)}
          className="select-premium py-2 text-sm w-full sm:w-auto"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={eventId}
          onChange={(e) => resetPageAnd(setEventId)(e.target.value)}
          className="select-premium py-2 text-sm w-full sm:w-auto"
        >
          <option value="">Todas las actividades</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead className="table-head text-xs uppercase text-muted">
            <tr>
              <th className="py-3 px-3 font-semibold">Fecha</th>
              <th className="py-3 px-3 font-semibold">Descripción</th>
              <th className="py-3 px-3 font-semibold">Tipo</th>
              <th className="py-3 px-3 font-semibold text-right">Monto</th>
              <th className="py-3 px-3 font-semibold">Categoría</th>
              <th className="py-3 px-3 font-semibold">Actividad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  Cargando movimientos...
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  Sin movimientos que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.id} className="hover:bg-surface-elevated transition-colors">
                  <td className="py-3 px-3 whitespace-nowrap text-foreground">
                    {record.date ? formatCalendarDate(record.date, "dd MMM yyyy", { locale: es }) : "—"}
                  </td>
                  <td className="py-3 px-3 text-foreground max-w-xs truncate" title={record.description}>
                    {record.description}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        record.type === "Ingreso" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                      }`}
                    >
                      {record.type}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-3 text-right whitespace-nowrap font-semibold font-mono ${
                      record.type === "Ingreso" ? "text-success" : "text-danger"
                    }`}
                  >
                    {record.type === "Ingreso" ? "+" : "-"}
                    {formatM(record.amount)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-muted">{record.categoryName ?? "—"}</td>
                  <td className="py-3 px-3 whitespace-nowrap text-muted">{record.eventName ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
        <span className="text-xs text-muted">
          Mostrando {records.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} de{" "}
          {total} movimientos
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-8 h-8 rounded-lg bg-surface-elevated hover:bg-border/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted px-1">
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-8 h-8 rounded-lg bg-surface-elevated hover:bg-border/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
