"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownRight, Activity, Wallet, PiggyBank, Briefcase, RefreshCw, Info } from "lucide-react";
import { fetchRecordsData } from "@/app/actions/sheets";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

export default function DashboardPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      setError(null);
      const data = await fetchRecordsData();
      setRecords(data);
      setLastUpdate(new Date());
    } catch (err) {
      setError("Error al cargar los datos. Por favor, intenta de nuevo.");
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calcular totales: sumar todos los montos directamente
  // Los egresos ya vienen con signo negativo en el monto, los ingresos vienen positivos
  const totalCajaChica = records
    .filter(r => r.category === "caja_chica")
    .reduce((acc, r) => acc + r.amount, 0);

  const totalFondoAhorro = records
    .filter(r => r.category === "fondo_ahorro")
    .reduce((acc, r) => acc + r.amount, 0);

  const saldoTotal = totalCajaChica + totalFondoAhorro;
  
  // Calcular total de egresos: usar valor absoluto para que siempre sea positivo
  const totalEgresos = records.reduce((acc, r) => {
    if (r.type.toLowerCase().includes("egreso")) {
      // Si el monto es negativo, usar su valor absoluto; si es positivo, usarlo tal cual
      return acc + Math.abs(r.amount);
    }
    return acc;
  }, 0);

  const formatM = (val: number) => "$" + val.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const stats = [
    {
      title: "Saldo Total",
      amount: isLoading ? "Cargando..." : formatM(saldoTotal),
      icon: <Wallet className="w-6 h-6 text-primary" />,
      trend: "Actualizado",
      isPositive: true,
    },
    {
      title: "Caja Chica",
      amount: isLoading ? "Cargando..." : formatM(totalCajaChica),
      icon: <Briefcase className="w-6 h-6 text-success" />,
      trend: "Desde GSheet",
      isPositive: true,
    },
    {
      title: "Fondo de Ahorro",
      amount: isLoading ? "Cargando..." : formatM(totalFondoAhorro),
      icon: <PiggyBank className="w-6 h-6 text-accent" />,
      trend: "Desde GSheet",
      isPositive: true,
    },
    {
      title: "Total Egresos (Gastos)",
      amount: isLoading ? "Cargando..." : formatM(totalEgresos),
      icon: <ArrowDownRight className="w-6 h-6 text-danger" />,
      trend: `${records.filter(r => r.type === "Egreso").length} registros`,
      isPositive: true,
    },
  ];

  // Preparar datos para el gráfico (agrupar por mes/año)
  const chartData = [...records].reverse().reduce((acc: any[], record) => {
    try {
      const date = parseISO(record.date);
      const monthYear = format(date, "MMM yy", { locale: es });
      const existing = acc.find(item => item.name === monthYear);
      const isIngreso = record.type.toLowerCase().includes("ingreso");
      const amount = record.amount || 0;

      if (existing) {
        if (isIngreso) existing.ingresos += amount;
        else existing.egresos += amount;
      } else {
        acc.push({
          name: monthYear,
          ingresos: isIngreso ? amount : 0,
          egresos: !isIngreso ? amount : 0,
        });
      }
    } catch (e) {
      // Ignorar fechas inválidas en el gráfico
    }
    return acc;
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Tesorería Centro de Padres</h1>
          <p className="text-white/60 text-sm md:text-base">Resumen general de la situación financiera y distribución de fondos.</p>
          {lastUpdate && (
            <p className="text-white/40 text-xs md:text-sm mt-1">
              Última actualización: {format(lastUpdate, "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          )}
          {error && (
            <p className="text-danger text-xs md:text-sm mt-1">⚠️ {error}</p>
          )}
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing}
          className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto"
          title="Actualizar datos"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          <span className="sm:hidden">{isRefreshing ? '...' : 'Actualizar'}</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="glass-panel p-4 md:p-6 flex flex-col hover:-translate-y-1 transition-transform duration-300 relative group"
            title={
              stat.title === "Saldo Total" 
                ? "Suma de Caja Chica y Fondo de Ahorro"
                : stat.title === "Total Egresos (Gastos)"
                ? "Total de todos los gastos registrados"
                : `Datos sincronizados desde Google Sheets`
            }
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="w-5 h-5 md:w-6 md:h-6">{stat.icon}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-md text-[10px] md:text-xs font-medium flex items-center gap-1 ${stat.isPositive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  <span className="hidden sm:inline">{stat.trend}</span>
                  <span className="sm:hidden">{stat.trend.split(' ')[0]}</span>
                </div>
                <Info className="w-3 h-3 md:w-4 md:h-4 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
              </div>
            </div>
            <div>
              <p className="text-white/50 text-xs md:text-sm font-medium mb-1">{stat.title}</p>
              <h3 className="text-xl md:text-2xl font-bold break-words">{stat.amount}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Resumen Ingresos vs Egresos */}
      {!isLoading && records.length > 0 && (
        <div className="glass-panel p-4 md:p-6 mb-6 md:mb-8">
          <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Resumen de Movimientos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <div className="flex flex-col items-center p-3 md:p-4 bg-success/10 rounded-xl border border-success/20">
              <ArrowUpRight className="w-6 h-6 md:w-8 md:h-8 text-success mb-2" />
              <p className="text-white/60 text-xs md:text-sm mb-1">Total Ingresos</p>
              <p className="text-lg md:text-2xl font-bold text-success break-words text-center">
                ${records
                  .filter(r => r.type.toLowerCase().includes("ingreso"))
                  .reduce((acc, r) => acc + Math.abs(r.amount), 0)
                  .toLocaleString('es-CL')}
              </p>
            </div>
            <div className="flex flex-col items-center p-3 md:p-4 bg-danger/10 rounded-xl border border-danger/20">
              <ArrowDownRight className="w-6 h-6 md:w-8 md:h-8 text-danger mb-2" />
              <p className="text-white/60 text-xs md:text-sm mb-1">Total Egresos</p>
              <p className="text-lg md:text-2xl font-bold text-danger break-words text-center">
                ${totalEgresos.toLocaleString('es-CL')}
              </p>
            </div>
            <div className="flex flex-col items-center p-3 md:p-4 bg-primary/10 rounded-xl border border-primary/20">
              <Activity className="w-6 h-6 md:w-8 md:h-8 text-primary mb-2" />
              <p className="text-white/60 text-xs md:text-sm mb-1">Diferencia</p>
              <p className={`text-lg md:text-2xl font-bold break-words text-center ${saldoTotal >= 0 ? 'text-success' : 'text-danger'}`}>
                ${saldoTotal.toLocaleString('es-CL')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts / Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Main Chart Card */}
        <div className="lg:col-span-2 glass-panel p-4 md:p-6 flex flex-col min-h-[300px] md:min-h-[400px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
            <h3 className="text-lg md:text-xl font-semibold">Análisis de Flujo</h3>
            <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs md:text-sm text-white/80 focus:outline-none focus:border-primary transition-colors w-full sm:w-auto">
              <option className="bg-secondary text-white">Todos los tiempos</option>
            </select>
          </div>
          <div className="flex-1 w-full relative min-h-[250px] md:min-h-[300px]">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/50 animate-pulse">Cargando gráfico...</p>
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10} 
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.3)" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1d2d', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any) => [`$${value.toLocaleString('es-CL')}`, undefined]}
                  />
                  <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorIngresos)" />
                  <Area type="monotone" dataKey="egresos" name="Egresos" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorEgresos)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                 <p className="text-white/40">No hay datos suficientes para el gráfico</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Card */}
        <div className="glass-panel p-4 md:p-6 flex flex-col min-h-[300px] md:min-h-[400px]">
          <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Actividad Reciente</h3>
          <div className="flex-1 flex flex-col gap-3 md:gap-4 mb-4 overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <p className="text-white/40 text-sm text-center my-auto animate-pulse">Cargando...</p>
            ) : records.length > 0 ? (
              records.slice(0, 6).map((record, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-2 rounded-full flex-shrink-0 ${record.type === 'Ingreso' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                      {record.type === 'Ingreso' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-white truncate max-w-[130px]" title={record.description}>
                        {record.description || "Sin descripción"}
                      </p>
                      <p className="text-xs text-white/50">
                        {record.date ? format(parseISO(record.date), "dd MMM yyyy", { locale: es }) : "Fecha inválida"}
                      </p>
                    </div>
                  </div>
                  <div className={`font-semibold text-sm flex-shrink-0 ${record.type === 'Ingreso' ? 'text-success' : 'text-white'}`}>
                    {record.type === 'Ingreso' ? '+' : '-'}${record.amount.toLocaleString('es-CL')}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-white/40 text-sm text-center my-auto">Sin registros recientes</p>
            )}
          </div>
          <Link href="/records" className="btn-secondary w-full text-center">
            Ver todos los registros
          </Link>
        </div>

      </div>

    </div>
  );
}

