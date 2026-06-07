"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, PartyPopper, TrendingUp, TrendingDown, Target } from "lucide-react";
import { fetchEvents } from "@/app/actions/events";
import { EventModal } from "@/components/ui/EventModal";
import type { EventSummary } from "@/lib/finance/types";

export default function EventsPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canManage =
    session?.user?.role === "ADMIN" || session?.user?.role === "DIRECTIVA";

  const loadEvents = () => {
    setIsLoading(true);
    fetchEvents()
      .then(setEvents)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const formatMoney = (n: number) =>
    "$" + n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Actividades</h1>
          <p className="text-white/60 text-sm md:text-base">
            Bingos, rifas, kermeses y otras recaudaciones con KPIs propios.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Nueva actividad
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 text-center text-white/50">Cargando actividades...</div>
      ) : events.length === 0 ? (
        <div className="glass-panel p-16 text-center">
          <PartyPopper className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/50 mb-4">No hay actividades registradas</p>
          {canManage && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              Crear primera actividad
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="glass-panel p-5 hover:border-primary/40 border border-transparent transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                    {event.name}
                  </h3>
                  <p className="text-white/50 text-xs">
                    {format(new Date(event.date), "dd MMMM yyyy", { locale: es })}
                  </p>
                </div>
                {event.goalProgress != null && (
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-accent/20 text-accent">
                    {event.goalProgress}%
                  </span>
                )}
              </div>

              {event.goal != null && event.goalProgress != null && (
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span>Meta: {formatMoney(event.goal)}</span>
                    <span>{formatMoney(event.totalIncome)} recaudado</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                      style={{ width: `${event.goalProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-success/10 rounded-lg p-2 border border-success/20">
                  <TrendingUp className="w-3 h-3 text-success mx-auto mb-1" />
                  <p className="text-white/50">Ingresos</p>
                  <p className="font-bold text-success font-mono">{formatMoney(event.totalIncome)}</p>
                </div>
                <div className="bg-danger/10 rounded-lg p-2 border border-danger/20">
                  <TrendingDown className="w-3 h-3 text-danger mx-auto mb-1" />
                  <p className="text-white/50">Gastos</p>
                  <p className="font-bold text-danger font-mono">{formatMoney(event.totalExpense)}</p>
                </div>
                <div className="bg-primary/10 rounded-lg p-2 border border-primary/20">
                  <Target className="w-3 h-3 text-primary mx-auto mb-1" />
                  <p className="text-white/50">Ganancia</p>
                  <p className={`font-bold font-mono ${event.profit >= 0 ? "text-success" : "text-danger"}`}>
                    {formatMoney(event.profit)}
                  </p>
                </div>
              </div>

              <p className="text-white/30 text-[10px] mt-3">{event.movementCount} movimientos vinculados</p>
            </Link>
          ))}
        </div>
      )}

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadEvents}
      />
    </div>
  );
}
