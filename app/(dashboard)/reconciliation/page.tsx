"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  History,
} from "lucide-react";
import {
  getCurrentReconciliationSnapshot,
  getReconciliationHistory,
  runReconciliationCheck,
  runSheetsImport,
} from "@/app/actions/reconciliation";
import { formatCLP as formatMoney } from "@/lib/format";
import { toast } from "sonner";

type Snapshot = Awaited<ReturnType<typeof getCurrentReconciliationSnapshot>>[number];
type HistoryItem = Awaited<ReturnType<typeof getReconciliationHistory>>[number];

export default function ReconciliationPage() {
  const [snapshot, setSnapshot] = useState<Snapshot[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const [current, logs] = await Promise.all([
      getCurrentReconciliationSnapshot(),
      getReconciliationHistory(),
    ]);
    setSnapshot(current);
    setHistory(logs);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleReconcile = async () => {
    setIsRunning(true);
    const result = await runReconciliationCheck();
    if (result.success) {
      setSnapshot(result.results);
      await loadData();
      toast.success("Conciliación ejecutada");
    } else {
      toast.error(result.error);
    }
    setIsRunning(false);
  };

  const handleImport = async () => {
    setIsImporting(true);
    const result = await runSheetsImport();
    if (result.success) {
      setSnapshot(result.results);
      await loadData();
      toast.success(`Importación completada: ${result.imported} nuevos, ${result.skipped} omitidos.`);
    } else {
      toast.error(result.error);
    }
    setIsImporting(false);
  };

  const allMatch = snapshot.length > 0 && snapshot.every((item) => item.status === "MATCH");

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Conciliación</h1>
          <p className="text-muted text-sm md:text-base">
            Compara saldos entre PostgreSQL y Google Sheets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={handleReconcile}
            disabled={isRunning || isImporting}
            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 flex-1 md:flex-none"
          >
            <RefreshCw className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
            Conciliar
          </button>
          <button
            onClick={handleImport}
            disabled={isRunning || isImporting}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 flex-1 md:flex-none"
          >
            <Download className={`w-4 h-4 ${isImporting ? "animate-spin" : ""}`} />
            Importar desde Sheets
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel p-8 text-center text-muted">Cargando conciliación...</div>
      ) : (
        <>
          <div
            className={`glass-panel p-4 md:p-6 mb-6 border ${
              allMatch ? "border-income/30 bg-income/5" : "border-expense/30 bg-expense/5"
            }`}
          >
            <div className="flex items-center gap-3">
              {allMatch ? (
                <CheckCircle2 className="w-8 h-8 text-income flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-expense flex-shrink-0" />
              )}
              <div>
                <p className="font-semibold text-lg">
                  {allMatch ? "Saldos conciliados" : "Hay diferencias por revisar"}
                </p>
                <p className="text-muted text-sm">
                  {allMatch
                    ? "PostgreSQL y Google Sheets coinciden en todos los fondos."
                    : "Revisa las diferencias abajo o importa movimientos faltantes desde Sheets."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {snapshot.map((item) => (
              <div key={item.fundId} className="glass-panel p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">{item.fundName}</h3>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      item.status === "MATCH"
                        ? "bg-income/20 text-income"
                        : "bg-expense/20 text-expense"
                    }`}
                  >
                    {item.status === "MATCH" ? "OK" : "DIFERENCIA"}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">Saldo Sheets</span>
                    <span className="tabular-nums">{formatMoney(item.sheetBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Saldo BD</span>
                    <span className="tabular-nums">{formatMoney(item.dbBalance)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted">Delta</span>
                    <span
                      className={`tabular-nums font-bold ${
                        item.delta === 0 ? "text-income" : "text-expense"
                      }`}
                    >
                      {formatMoney(item.delta)}
                    </span>
                  </div>
                  <p className="text-muted text-xs pt-1">{item.rowCount} filas en Sheets</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel overflow-hidden">
            <div className="p-4 md:p-5 border-b border-border flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Historial de conciliaciones</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase table-head text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Fondo</th>
                    <th className="px-4 py-3 text-right">Sheets</th>
                    <th className="px-4 py-3 text-right">BD</th>
                    <th className="px-4 py-3 text-right">Delta</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted">
                        Sin registros de conciliación
                      </td>
                    </tr>
                  ) : (
                    history.map((log) => (
                      <tr key={log.id} className="hover:bg-surface-elevated">
                        <td className="px-4 py-3 whitespace-nowrap text-muted">
                          {format(new Date(log.createdAt), "dd/MM/yy HH:mm", { locale: es })}
                        </td>
                        <td className="px-4 py-3">{log.fundName}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(log.sheetBalance)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(log.dbBalance)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums ${
                            log.delta === 0 ? "text-income" : "text-expense"
                          }`}
                        >
                          {formatMoney(log.delta)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              log.status === "MATCH"
                                ? "bg-income/20 text-income"
                                : "bg-expense/20 text-expense"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
