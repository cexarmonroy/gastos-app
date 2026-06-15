"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Shield, ChevronDown, ChevronUp, Search, Filter } from "lucide-react";
import { getAuditFilterOptions, getAuditLogs } from "@/app/actions/audit";
import {
  AUDIT_ACTION_LABELS,
  auditSnapshotToLines,
  formatAuditEntity,
} from "@/lib/audit-labels";
import { formatAuditNarrative } from "@/lib/audit-narrative";

type AuditLogItem = Awaited<ReturnType<typeof getAuditLogs>>[number];

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ actions: string[]; entities: string[] }>({
    actions: [],
    entities: [],
  });
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAuditLogs({
        action: actionFilter ? (actionFilter as AuditLogItem["action"]) : undefined,
        entity: entityFilter || undefined,
        search: search || undefined,
      });
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar auditoría.");
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, entityFilter, search]);

  useEffect(() => {
    getAuditFilterOptions()
      .then(setFilterOptions)
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar filtros."));
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadLogs, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadLogs, search]);

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      counts.set(log.action, (counts.get(log.action) ?? 0) + 1);
    }
    return counts;
  }, [logs]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="w-7 h-7 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Auditoría</h1>
        </div>
        <p className="text-white/60 text-sm md:text-base">
          Historial completo de movimientos, adjuntos, reportes e importaciones.
        </p>
      </div>

      <div className="glass-panel p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por entidad o ID..."
            className="input-premium pl-10 py-2 text-sm w-full"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="select-premium py-2 text-sm"
        >
          <option value="">Todas las acciones</option>
          {filterOptions.actions.map((action) => (
            <option key={action} value={action}>
              {AUDIT_ACTION_LABELS[action] ?? action}
            </option>
          ))}
        </select>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="select-premium py-2 text-sm"
        >
          <option value="">Todas las entidades</option>
          {filterOptions.entities.map((entity) => (
            <option key={entity} value={entity}>
              {formatAuditEntity(entity)}
            </option>
          ))}
        </select>
      </div>

      {!isLoading && logs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.from(stats.entries()).map(([action, count]) => (
            <span
              key={action}
              className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60"
            >
              {AUDIT_ACTION_LABELS[action] ?? action}: {count}
            </span>
          ))}
        </div>
      )}

      {error && (
        <div className="glass-panel p-4 mb-6 border border-danger/30 text-danger text-sm">{error}</div>
      )}

      <div className="glass-panel overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-white/50">Cargando auditoría...</p>
        ) : logs.length === 0 ? (
          <p className="p-8 text-center text-white/50">Sin registros con esos filtros</p>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log) => {
              const isExpanded = expandedId === log.id;
              const oldLines = auditSnapshotToLines(log.oldValues);
              const newLines = auditSnapshotToLines(log.newValues);
              const metadataLines = auditSnapshotToLines(log.metadata);

              return (
                <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                  <button
                    className="w-full flex items-start justify-between gap-4 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/20 text-primary">
                          {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                        </span>
                        <span className="text-sm text-white/80">{formatAuditEntity(log.entity)}</span>
                        <span className="text-xs text-white/30 font-mono truncate">{log.entityId.slice(0, 8)}…</span>
                      </div>
                      <p className="text-sm text-white/90 leading-snug mb-1">
                        {formatAuditNarrative(log)}
                      </p>
                      <p className="text-xs text-white/50">
                        {log.userEmail} · {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                      </p>
                      {!isExpanded && newLines[0] && (
                        <p className="text-xs text-white/30 mt-1 truncate">{newLines[0]}</p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
                    )}
                  </button>

                  {isExpanded && (oldLines.length > 0 || newLines.length > 0 || metadataLines.length > 0) && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {oldLines.length > 0 && (
                        <div className="bg-black/30 rounded-lg p-3">
                          <p className="text-white/40 mb-2 font-semibold">Antes</p>
                          <ul className="space-y-1 text-white/60">
                            {oldLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {newLines.length > 0 && (
                        <div className="bg-black/30 rounded-lg p-3">
                          <p className="text-white/40 mb-2 font-semibold">Después</p>
                          <ul className="space-y-1 text-white/70">
                            {newLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {metadataLines.length > 0 && (
                        <div className="bg-black/30 rounded-lg p-3 md:col-span-2">
                          <p className="text-white/40 mb-2 font-semibold flex items-center gap-1">
                            <Filter className="w-3 h-3" /> Detalle
                          </p>
                          <ul className="space-y-1 text-white/70">
                            {metadataLines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
