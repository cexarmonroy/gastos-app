"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

  const formatMoney = (n: number) =>
    "$" + n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

  if (isLoading) {
    return <div className="glass-panel p-12 text-center text-white/50">Cargando...</div>;
  }

  if (!event) {
    return (
      <div className="glass-panel p-12 text-center">
        <p className="text-white/50 mb-4">Actividad no encontrada</p>
        <Link href="/events" className="btn-secondary">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a actividades
      </Link>

      <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{event.name}</h1>
          <p className="text-white/60 text-sm">
            {format(new Date(event.date), "dd MMMM yyyy", { locale: es })}
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
          <TrendingUp className="w-5 h-5 text-success mb-2" />
          <p className="text-white/50 text-sm">Ingresos</p>
          <p className="text-2xl font-bold text-success">{formatMoney(event.totalIncome)}</p>
        </div>
        <div className="glass-panel p-5">
          <TrendingDown className="w-5 h-5 text-danger mb-2" />
          <p className="text-white/50 text-sm">Gastos</p>
          <p className="text-2xl font-bold text-danger">{formatMoney(event.totalExpense)}</p>
        </div>
        <div className="glass-panel p-5">
          <Target className="w-5 h-5 text-primary mb-2" />
          <p className="text-white/50 text-sm">Ganancia neta</p>
          <p className={`text-2xl font-bold ${event.profit >= 0 ? "text-success" : "text-danger"}`}>
            {formatMoney(event.profit)}
          </p>
        </div>
        {event.goal != null && (
          <div className="glass-panel p-5">
            <p className="text-white/50 text-sm mb-1">Meta de recaudación</p>
            <p className="text-2xl font-bold">{formatMoney(event.goal)}</p>
            {event.goalProgress != null && (
              <p className="text-accent text-sm mt-1">{event.goalProgress}% alcanzado</p>
            )}
          </div>
        )}
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold">Movimientos vinculados ({event.movements.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase bg-[#0f1115] text-white/60">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {event.movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-white/40">
                    Sin movimientos. Agrega ingresos y gastos de esta actividad.
                  </td>
                </tr>
              ) : (
                event.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 whitespace-nowrap text-white/70">
                      {format(new Date(m.date), "dd/MM/yyyy")}
                    </td>
                    <td className="px-4 py-3">{m.description || "—"}</td>
                    <td className="px-4 py-3 text-white/60">{m.categoryName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          m.type === "Ingreso"
                            ? "bg-success/10 text-success"
                            : "bg-danger/10 text-danger"
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-semibold ${
                        m.type === "Ingreso" ? "text-success" : "text-danger"
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
