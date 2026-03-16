"use client";

import { useState } from "react";
import { X, Calendar as CalendarIcon, Tag, AlignLeft, DollarSign } from "lucide-react";

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: any | null; // Null means creating new
}

export function RecordModal({ isOpen, onClose, record }: RecordModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[#1a1d2d] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-white/10 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[50px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
          
          <h2 className="text-xl font-bold">
            {record ? "Editar Registro" : "Nuevo Registro"}
          </h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors relative z-10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form className="p-6 space-y-5">
           
          {/* Amount & Type row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Monto</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="number" 
                  step="0.01"
                  className="input-premium pl-10" 
                  placeholder="0.00" 
                  defaultValue={record?.amount}
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Tipo</label>
              <select className="input-premium appearance-none py-[11px]" defaultValue={record?.type || "Ingreso"}>
                <option className="bg-secondary">Ingreso</option>
                <option className="bg-secondary">Egreso</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">Descripción</label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-white/40" />
              <textarea 
                className="input-premium pl-10 resize-none min-h-[80px]" 
                placeholder="Detalles del registro..."
                defaultValue={record?.description}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white/80">Categoría</label>
            <select className="input-premium appearance-none py-[11px]" defaultValue={record?.category || "caja_chica"}>
              <option value="caja_chica" className="bg-secondary">Caja Chica</option>
              <option value="fondo_ahorro" className="bg-secondary">Fondo de Ahorro</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Fecha</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="date" 
                  className="input-premium pl-10 [&::-webkit-calendar-picker-indicator]:invert-[0.8]" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">Etiquetas</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input 
                  type="text" 
                  className="input-premium pl-10" 
                  placeholder="ej. fijo, servicios..." 
                />
              </div>
              <p className="text-[10px] text-white/40 mt-1">Separadas por comas</p>
            </div>
          </div>

        </form>

        <div className="p-6 border-t border-white/10 flex items-center justify-end gap-3 bg-white/5 rounded-b-2xl">
          <button type="button" onClick={onClose} className="btn-secondary px-5 py-2">
            Cancelar
          </button>
          <button type="submit" className="btn-primary px-5 py-2">
            Guardar
          </button>
        </div>

      </div>
    </div>
  );
}
