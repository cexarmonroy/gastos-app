"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { History, Loader2, Shield } from "lucide-react";
import { getRecentAuditLogs } from "@/app/actions/audit";
import { formatAuditNarrative } from "@/lib/audit-narrative";
import { AUDIT_ACTION_LABELS } from "@/lib/audit-labels";

type AuditItem = Awaited<ReturnType<typeof getRecentAuditLogs>>[number];

export function RecentActivityPanel() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRecentAuditLogs(8)
      .then(setLogs)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "No se pudo cargar la actividad.")
      )
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="glass-panel p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Últimos cambios</h3>
        </div>
        <Link href="/audit" className="text-primary text-sm hover:underline">
          Ver todo
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Cargando...
        </div>
      ) : error ? (
        <p className="text-danger text-sm py-4">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-white/40 text-sm py-4">Sin actividad registrada</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-2">
                <History className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/90 leading-snug">
                    {formatAuditNarrative(log)}
                  </p>
                  <p className="text-[11px] text-white/40 mt-1">
                    {AUDIT_ACTION_LABELS[log.action] ?? log.action} ·{" "}
                    {format(new Date(log.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
