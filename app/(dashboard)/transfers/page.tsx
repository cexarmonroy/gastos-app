"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRightLeft, Plus } from "lucide-react";
import { fetchTransfers } from "@/app/actions/transfers";
import { TransferModal } from "@/components/ui/TransferModal";

type TransferItem = Awaited<ReturnType<typeof fetchTransfers>>[number];

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadTransfers = () => {
    setIsLoading(true);
    fetchTransfers().then((data) => {
      setTransfers(data);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadTransfers();
  }, []);

  const formatMoney = (value: number) =>
    "$" + value.toLocaleString("es-CL", { maximumFractionDigits: 0 });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transferencias</h1>
          <p className="text-white/60 text-sm md:text-base">
            Mueve dinero entre Caja Chica y Fondo de Ahorro sin afectar el saldo total.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva transferencia
        </button>
      </div>

      <div className="glass-panel flex-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-[#0f1115] border-b border-white/10 text-white/70">
              <tr>
                <th className="px-4 py-4">Fecha</th>
                <th className="px-4 py-4">Origen → Destino</th>
                <th className="px-4 py-4">Descripción</th>
                <th className="px-4 py-4 text-right">Monto</th>
                <th className="px-4 py-4 hidden md:table-cell">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-white/50">
                    Cargando transferencias...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3 text-white/40">
                      <ArrowRightLeft className="w-12 h-12 opacity-30" />
                      <p>No hay transferencias registradas</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-white/5">
                    <td className="px-4 py-4 whitespace-nowrap text-white/80">
                      {format(new Date(transfer.date), "dd MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-xs">
                          {transfer.fromFundName}
                        </span>
                        <ArrowRightLeft className="w-3 h-3 text-accent" />
                        <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs border border-accent/20">
                          {transfer.toFundName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/70 max-w-xs truncate" title={transfer.description}>
                      {transfer.description || "—"}
                    </td>
                    <td className="px-4 py-4 text-right font-semibold text-accent font-mono">
                      {formatMoney(transfer.amount)}
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell text-white/50 text-xs">
                      {transfer.createdByEmail ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TransferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadTransfers}
      />
    </div>
  );
}
