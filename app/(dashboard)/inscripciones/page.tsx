"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, Users, Download } from "lucide-react";
import { getInscripcionesSheets, getInscripcionesData } from "@/app/actions/sheets";

export default function InscripcionesPage() {
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [students, setStudents] = useState<any[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    getInscripcionesSheets().then(data => {
      setSheets(data);
      if (data.length > 0) {
        setSelectedSheet(data[0]);
      }
      setIsLoadingSheets(false);
    });
  }, []);

  useEffect(() => {
    if (selectedSheet) {
      setIsLoadingData(true);
      getInscripcionesData(selectedSheet).then(data => {
        setStudents(data);
        setIsLoadingData(false);
      });
    }
  }, [selectedSheet]);

  const filteredStudents = students.filter(s => {
    const searchLow = searchTerm.toLowerCase();
    return (
      s.nombres.toLowerCase().includes(searchLow) ||
      s.apellidoPaterno.toLowerCase().includes(searchLow) ||
      s.apellidoMaterno.toLowerCase().includes(searchLow) ||
      s.apoderado.toLowerCase().includes(searchLow)
    );
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col h-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Inscripciones 2026</h1>
            {!isLoadingData && students.length > 0 && (
              <span className="bg-primary/20 text-primary text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full border border-primary/30 flex items-center gap-1.5 animate-in zoom-in duration-300">
                <Users className="w-3 h-3" />
                {students.length} Alumnos
              </span>
            )}
          </div>
          <p className="text-white/60 text-sm md:text-base">Consulta las listas de alumnos inscritos por curso desde el documento oficial.</p>
        </div>
      </div>

      <div className="glass-panel p-4 mb-6 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1">
            <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-widest font-bold">Seleccionar Curso</label>
            <div className="relative">
              {isLoadingSheets ? (
                <div className="input-premium flex items-center gap-2 text-white/40 italic">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando listado de cursos...
                </div>
              ) : (
                <select 
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="select-premium"
                >
                  {sheets.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex-1">
            <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-widest font-bold">Buscar Estudiante</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input 
                type="text" 
                placeholder="Nombre, apellido o apoderado..." 
                className="input-premium pl-10 focus:ring-2 focus:ring-primary/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel flex-1 flex flex-col overflow-hidden shadow-2xl border-white/5">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-xs md:text-sm text-left border-collapse">
            <thead className="text-[10px] md:text-xs uppercase bg-[#0f1115] border-b border-white/10 sticky top-0 z-20">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-white/70 tracking-wider">Nombre</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-white/70 tracking-wider hidden sm:table-cell">Fecha</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-white/70 tracking-wider">Apoderado</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-white/70 tracking-wider hidden lg:table-cell">Email</th>
                <th className="px-4 md:px-6 py-3 md:py-4 font-bold text-white/70 tracking-wider hidden xl:table-cell">Prof.</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-bold text-white/70 tracking-wider">Fono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoadingData ? (
                <tr>
                  <td colSpan={6} className="text-center py-24">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                        <Users className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                      </div>
                      <p className="text-white/50 font-medium animate-pulse">Sincronizando con Google Sheets...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-24">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <Users className="w-16 h-16 mb-2" />
                      <p className="text-xl font-bold">Sin resultados</p>
                      <p className="text-sm max-w-xs mx-auto">No hay alumnos que coincidan con los criterios en el curso seleccionado.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-white/5 transition-all duration-200 group border-l-2 border-l-transparent hover:border-l-primary">
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-xs md:text-sm group-hover:text-primary transition-colors leading-tight">
                          {student.apellidoPaterno}
                        </span>
                        <span className="text-white/50 text-[10px] md:text-xs">
                          {student.nombres}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 md:py-5 text-white/40 font-mono text-[10px] md:text-[11px] hidden sm:table-cell">{student.fecha}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-white/80 text-[11px] md:text-sm leading-tight">
                      {student.apoderado}
                    </td>
                    <td className="px-4 md:px-6 py-4 md:py-5 hidden lg:table-cell">
                      {student.mail ? (
                        <a href={`mailto:${student.mail}`} className="text-primary hover:text-white transition-colors text-xs font-medium bg-primary/10 px-2 py-1 rounded border border-primary/20 truncate block max-w-[200px]" title={student.mail}>
                          {student.mail}
                        </a>
                      ) : (
                        <span className="text-white/20 italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-4 md:py-5 text-white/50 italic text-[10px] md:text-xs hidden xl:table-cell truncate max-w-[100px]">{student.profesion || "—"}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4">
                      <span className="text-accent font-mono font-bold tracking-tight text-[10px] md:text-sm whitespace-nowrap">
                        {student.fono}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="border-t border-white/10 p-4 flex items-center justify-between text-[11px] md:text-xs text-white/40 bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 border border-white/10 flex items-center justify-center text-[10px] text-primary">A</div>
              <div className="w-6 h-6 rounded-full bg-accent/20 border border-white/10 flex items-center justify-center text-[10px] text-accent">B</div>
              <div className="w-6 h-6 rounded-full bg-success/20 border border-white/10 flex items-center justify-center text-[10px] text-success">C</div>
            </div>
            <span className="hidden sm:inline">Total de {filteredStudents.length} {filteredStudents.length === 1 ? 'estudiante encontrado' : 'estudiantes encontrados'} en {selectedSheet}</span>
            <span className="sm:hidden">{filteredStudents.length} alumnos</span>
          </div>
          <div className="flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
             Conectado a Planilla Online
          </div>
        </div>
      </div>
    </div>
  );
}
