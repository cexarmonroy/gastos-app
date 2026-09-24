"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { es } from "date-fns/locale";
import { formatCalendarDate } from "@/lib/date-only";
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  TrendingDown,
  Target,
  Pencil,
} from "lucide-react";
import { getEventDetail } from "@/app/actions/events";
import { EventModal } from "@/components/ui/EventModal";
import { RecordModal } from "@/components/ui/RecordModal";
import type { EventSummary, MovementRecord } from "@/lib/finance/types";
import { formatCLP as formatMoney } from "@/lib/format";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const [eventId, setEventId] = useState<string>("");
  const [event, setEvent] = useState<
    (EventSummary & { movements: MovementRecord[] }) | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  const canManage =
    session?.user?.role === "ADMIN" || session?.user?.role === "DIRECTIVA";

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  const loadEvent = () => {
    if (!eventId) return;
    setIsLoading(true);
    getEventDetail(eventId)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  if (isLoading) {
    return <div className="glass-panel p-12 text-center text-muted">Cargando...</div>;
  }

  if (!event) {
    return (
      <div className="glass-panel p-12 text-center">
        <p className="text-muted mb-4">Actividad no encontrada</p>
        <Link href="/events" className="btn-secondary">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-muted hover:text-foreground text-sm mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a actividades
      </Link>

      <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{event.name}</h1>
          <p className="text-muted text-sm">
            {formatCalendarDate(event.date, "dd MMMM yyyy", { locale: es })}
            {event.description ? ` · ${event.description}` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsEventModalOpen(true)}
              className="btn-secondary flex items-center gap-2 flex-1 md:flex-none justify-center"
            >
              <Pencil className="w-4 h-4" />
              Editar
            </button>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="btn-primary flex items-center gap-2 flex-1 md:flex-none justify-center"
            >
              <Plus className="w-4 h-4" />
              Agregar movimiento
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel p-5">
          <TrendingUp className="w-5 h-5 text-income mb-2" />
          <p className="text-muted text-sm">Ingresos</p>
          <p className="text-2xl font-bold text-income">{formatMoney(event.totalIncome)}</p>
        </div>
        <div className="glass-panel p-5">
          <TrendingDown className="w-5 h-5 text-expense mb-2" />
          <p className="text-muted text-sm">Gastos</p>
          <p className="text-2xl font-bold text-expense">{formatMoney(event.totalExpense)}</p>
        </div>
        <div className="glass-panel p-5">
          <Target className="w-5 h-5 text-primary mb-2" />
          <p className="text-muted text-sm">Ganancia neta</p>
          <p className={`text-2xl font-bold ${event.profit >= 0 ? "text-income" : "text-expense"}`}>
            {formatMoney(event.profit)}
          </p>
        </div>
        {event.goal != null && (
          <div className="glass-panel p-5">
            <p className="text-muted text-sm mb-1">Meta de recaudación</p>
            <p className="text-2xl font-bold">{formatMoney(event.goal)}</p>
            {event.goalProgress != null && (
              <p className="text-info text-sm mt-1">{event.goalProgress}% alcanzado</p>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Movimientos vinculados ({event.movements.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase table-head text-muted">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {event.movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted">
                    Sin movimientos. Agrega ingresos y gastos de esta actividad.
                  </td>
                </tr>
              ) : (
                event.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-elevated">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatCalendarDate(m.date, "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-3">{m.description || "—"}</td>
                    <td className="px-4 py-3 text-muted">{m.categoryName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          m.type === "Ingreso"
                            ? "bg-income/10 text-income"
                            : "bg-expense/10 text-expense"
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-semibold ${
                        m.type === "Ingreso" ? "text-income" : "text-expense"
                      }`}
                    >
                      {formatMoney(Math.abs(m.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSaved={loadEvent}
        event={event}
      />

      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSaved={loadEvent}
        defaultEventId={event.id}
      />
    </div>
  );
}
