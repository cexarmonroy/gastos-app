"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Wallet,
  PiggyBank,
  Briefcase,
  RefreshCw,
  Info,
  HardHat,
  PartyPopper,
} from "lucide-react";
import { fetchMovementsData } from "@/app/actions/movements";
import { fetchProjects } from "@/app/actions/projects";
import { fetchEvents } from "@/app/actions/events";
import { buildCategoryBreakdown } from "@/lib/finance/category-breakdown";
import {
  buildBalanceChartData,
  buildFlowChartData,
} from "@/lib/finance/chart-data";
import { computeFundBalance } from "@/lib/finance/map-movement";
import {
  getMovementDisplayLabel,
  getMovementSubtitle,
} from "@/lib/finance/movement-label";
import {
  filterRecordsByPeriod,
  getPeriodLabel,
  sumExpense,
  sumIncome,
  type DashboardPeriod,
} from "@/lib/finance/period-filter";
import type { EventSummary, MovementRecord, ProjectSummary } from "@/lib/finance/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

type ChartMode = "flow" | "balance";

export default function DashboardPage() {
  const [records, setRecords] = useState<MovementRecord[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [chartMode, setChartMode] = useState<ChartMode>("flow");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      setError(null);

      const [movements, projectList, eventList] = await Promise.all([
        fetchMovementsData(),
        fetchProjects(),
        fetchEvents(),
      ]);

      setRecords(movements);
      setProjects(projectList);
      setEvents(eventList);
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

  const periodRecords = useMemo(
    () => filterRecordsByPeriod(records, period),
    [records, period]
  );
  const periodLabel = getPeriodLabel(period);

  const totalCajaChica = computeFundBalance(records, "caja_chica");
  const totalFondoAhorro = computeFundBalance(records, "fondo_ahorro");
  const saldoTotal = totalCajaChica + totalFondoAhorro;

  const periodIngresos = sumIncome(periodRecords);
  const periodEgresos = sumExpense(periodRecords);
  const periodResultado = periodIngresos - periodEgresos;

  const expenseBreakdown = useMemo(
    () =>
      buildCategoryBreakdown(periodRecords.filter((r) => r.type === "Egreso")).slice(0, 5),
    [periodRecords]
  );
  const incomeBreakdown = useMemo(
    () =>
      buildCategoryBreakdown(periodRecords.filter((r) => r.type === "Ingreso")).slice(0, 5),
    [periodRecords]
  );

  const flowChartData = useMemo(
    () => buildFlowChartData(periodRecords, period),
    [periodRecords, period]
  );
  const balanceChartData = useMemo(() => buildBalanceChartData(records), [records]);

  const priorityProject = useMemo(() => {
    const active = projects.filter((p) => p.status === "IN_PROGRESS");
    const pool = active.length > 0 ? active : projects.filter((p) => p.status === "PLANNED");
    if (pool.length === 0) return projects[0] ?? null;
    return pool.reduce((best, current) =>
      current.targetAmount > best.targetAmount ? current : best
    );
  }, [projects]);

  const latestEvent = useMemo(() => {
    const withMovements = events.filter((e) => e.movementCount > 0);
    if (withMovements.length === 0) return events[0] ?? null;
    return withMovements.reduce((latest, current) =>
      new Date(current.date) > new Date(latest.date) ? current : latest
    );
  }, [events]);

  const formatM = (val: number) =>
    "$" + val.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const positionStats = [
    {
      title: "Saldo Total",
      amount: isLoading ? "Cargando..." : formatM(saldoTotal),
      icon: <Wallet className="w-6 h-6 text-primary" />,
      trend: "Posición actual",
      hint: "Suma de Caja Chica y Fondo de Ahorro",
    },
    {
      title: "Caja Chica",
      amount: isLoading ? "Cargando..." : formatM(totalCajaChica),
      icon: <Briefcase className="w-6 h-6 text-success" />,
      trend: "Posición actual",
      hint: "Saldo acumulado en Caja Chica",
    },
    {
      title: "Fondo de Ahorro",
      amount: isLoading ? "Cargando..." : formatM(totalFondoAhorro),
      icon: <PiggyBank className="w-6 h-6 text-accent" />,
      trend: "Posición actual",
      hint: "Saldo acumulado en Fondo de Ahorro",
    },
  ];

  const periodStats = [
    {
      title: `Ingresos — ${periodLabel}`,
      amount: isLoading ? "Cargando..." : formatM(periodIngresos),
      icon: <ArrowUpRight className="w-6 h-6 text-success" />,
      iconBoxClass: "bg-success/10 border-success/20",
      amountClass: "text-success",
      subtitle: undefined as string | undefined,
    },
    {
      title: `Egresos — ${periodLabel}`,
      amount: isLoading ? "Cargando..." : formatM(periodEgresos),
      icon: <ArrowDownRight className="w-6 h-6 text-danger" />,
      iconBoxClass: "bg-danger/10 border-danger/20",
      amountClass: "text-danger",
      subtitle: undefined as string | undefined,
    },
    {
      title: `Resultado — ${periodLabel}`,
      amount: isLoading ? "Cargando..." : formatM(periodResultado),
      icon: <Activity className="w-6 h-6 text-primary" />,
      iconBoxClass: "bg-primary/10 border-primary/20",
      amountClass: periodResultado >= 0 ? "text-success" : "text-danger",
      subtitle: undefined as string | undefined,
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Tesorería Centro de Padres
          </h1>
          <p className="text-white/60 text-sm md:text-base">
            Posición actual de fondos y resultado del período seleccionado
          </p>
          {lastUpdate && (
            <p className="text-white/40 text-xs md:text-sm mt-1">
              Última actualización: {format(lastUpdate, "dd/MM/yyyy HH:mm", { locale: es })}
            </p>
          )}
          {error && <p className="text-danger text-xs md:text-sm mt-1">⚠️ {error}</p>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
            className="select-premium py-2 text-xs md:text-sm w-full sm:min-w-[180px]"
          >
            <option value="month">Mes actual</option>
            <option value="year">Año actual</option>
            <option value="all">Histórico completo</option>
          </select>
          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {isRefreshing ? "Actualizando..." : "Actualizar"}
            </span>
            <span className="sm:hidden">{isRefreshing ? "..." : "Actualizar"}</span>
          </button>
        </div>
      </div>

      {/* Posición actual */}
      <div className="mb-2">
        <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
          Posición actual
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {positionStats.map((stat) => (
          <div
            key={stat.title}
            className="glass-panel p-4 md:p-6 flex flex-col hover:-translate-y-1 transition-transform duration-300 relative group"
            title={stat.hint}
          >
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="w-5 h-5 md:w-6 md:h-6">{stat.icon}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-1.5 md:px-2 py-0.5 md:py-1 rounded-md text-[10px] md:text-xs font-medium bg-white/5 text-white/60">
                  {stat.trend}
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

      {/* Resultado del período */}
      <div className="mb-2">
        <p className="text-white/40 text-xs font-medium uppercase tracking-wider">
          Resultado del período — {periodLabel}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {periodStats.map((stat) => (
          <div key={stat.title} className="glass-panel p-4 md:p-6 flex flex-col">
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className={`p-2 md:p-3 rounded-xl border ${stat.iconBoxClass}`}>
                <div className="w-5 h-5 md:w-6 md:h-6">{stat.icon}</div>
              </div>
            </div>
            <p className="text-white/50 text-xs md:text-sm font-medium mb-1">{stat.title}</p>
            <h3 className={`text-xl md:text-2xl font-bold break-words ${stat.amountClass}`}>
              {stat.amount}
            </h3>
            {stat.subtitle && (
              <p className="text-white/40 text-xs mt-1">{stat.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {/* Top categorías del período */}
      {!isLoading && periodRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-1">Top Ingresos por Categoría</h3>
            <p className="text-white/40 text-xs mb-4">{periodLabel}</p>
            <div className="space-y-3">
              {incomeBreakdown.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos en este período</p>
              ) : (
                incomeBreakdown.map((item) => (
                  <div
                    key={item.categoryId ?? item.categoryName}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-white/70">{item.categoryName}</span>
                    <span className="text-success font-semibold font-mono">
                      ${item.total.toLocaleString("es-CL")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-1">Top Gastos por Categoría</h3>
            <p className="text-white/40 text-xs mb-4">{periodLabel}</p>
            <div className="space-y-3">
              {expenseBreakdown.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos en este período</p>
              ) : (
                expenseBreakdown.map((item) => (
                  <div
                    key={item.categoryId ?? item.categoryName}
                    className="flex justify-between items-center text-sm"
                  >
                    <span className="text-white/70">{item.categoryName}</span>
                    <span className="text-danger font-semibold font-mono">
                      ${item.total.toLocaleString("es-CL")}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Widgets Proyecto + Actividad */}
      {!isLoading && (priorityProject || latestEvent) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          {priorityProject && (
            <div className="glass-panel p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <HardHat className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Proyecto Prioritario</h3>
              </div>
              <p className="text-xl font-bold mb-1">{priorityProject.name}</p>
              <p className="text-white/50 text-sm mb-4">
                Meta: {formatM(priorityProject.targetAmount)}
              </p>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-white/60">Avance</span>
                <span className="font-semibold">{priorityProject.progress}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, priorityProject.progress)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/60">
                  Actual: {formatM(priorityProject.totalIncome)}
                </span>
                <Link href={`/projects/${priorityProject.id}`} className="text-primary hover:underline">
                  Ver proyecto →
                </Link>
              </div>
            </div>
          )}
          {latestEvent && (
            <div className="glass-panel p-4 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <PartyPopper className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold">Última Actividad</h3>
              </div>
              <p className="text-xl font-bold mb-1">{latestEvent.name}</p>
              <p className="text-white/50 text-sm mb-4">
                {format(parseISO(latestEvent.date), "dd MMMM yyyy", { locale: es })}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Ingresos</span>
                  <span className="text-success font-semibold font-mono">
                    {formatM(latestEvent.totalIncome)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Gastos</span>
                  <span className="text-danger font-semibold font-mono">
                    {formatM(latestEvent.totalExpense)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-white/60 font-medium">Ganancia</span>
                  <span
                    className={`font-bold font-mono ${
                      latestEvent.profit >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatM(latestEvent.profit)}
                  </span>
                </div>
              </div>
              <Link
                href={`/events/${latestEvent.id}`}
                className="text-primary text-sm mt-4 inline-block hover:underline"
              >
                Ver actividad →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Gráfico + Actividad reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 glass-panel p-4 md:p-6 flex flex-col min-h-[300px] md:min-h-[400px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-6">
            <div>
              <h3 className="text-lg md:text-xl font-semibold">
                {chartMode === "flow" ? "Ingresos vs Gastos" : "Evolución del Saldo"}
              </h3>
              <p className="text-white/40 text-xs mt-0.5">
                {chartMode === "flow" ? periodLabel : "Histórico completo"}
              </p>
            </div>
            <select
              value={chartMode}
              onChange={(e) => setChartMode(e.target.value as ChartMode)}
              className="select-premium py-1.5 text-xs md:text-sm w-full sm:w-auto sm:min-w-[200px]"
            >
              <option value="flow">Ingresos vs gastos</option>
              <option value="balance">Evolución del saldo</option>
            </select>
          </div>
          <div className="flex-1 w-full relative min-h-[250px] md:min-h-[300px]">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/50 animate-pulse">Cargando gráfico...</p>
              </div>
            ) : chartMode === "flow" && flowChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flowChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEgresos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
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
                    tickFormatter={(value) =>
                      `$${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1d2d",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    itemStyle={{ color: "#fff" }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString("es-CL")}`, undefined]}
                  />
                  <Area
                    type="monotone"
                    dataKey="ingresos"
                    name="Ingresos"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorIngresos)"
                  />
                  <Area
                    type="monotone"
                    dataKey="egresos"
                    name="Gastos"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorEgresos)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : chartMode === "balance" && balanceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={balanceChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
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
                    tickFormatter={(value) =>
                      `$${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1d2d",
                      borderColor: "rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                    formatter={(value: any) => [
                      `$${Number(value).toLocaleString("es-CL")}`,
                      "Saldo",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/40">No hay datos suficientes para el gráfico</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-4 md:p-6 flex flex-col min-h-[300px] md:min-h-[400px]">
          <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Actividad Reciente</h3>
          <div className="flex-1 flex flex-col gap-3 md:gap-4 mb-4 overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <p className="text-white/40 text-sm text-center my-auto animate-pulse">Cargando...</p>
            ) : records.length > 0 ? (
              records.slice(0, 6).map((record) => {
                const label = getMovementDisplayLabel(record);
                const subtitle = getMovementSubtitle(record);
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      <div
                        className={`p-2 rounded-full flex-shrink-0 ${
                          record.type === "Ingreso"
                            ? "bg-success/20 text-success"
                            : "bg-danger/20 text-danger"
                        }`}
                      >
                        {record.type === "Ingreso" ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="overflow-hidden min-w-0">
                        <p className="text-sm font-medium text-white truncate" title={label}>
                          {label}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {subtitle
                            ? `${subtitle} · `
                            : ""}
                          {record.date
                            ? format(parseISO(record.date), "dd MMM yyyy", { locale: es })
                            : "Fecha inválida"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`font-semibold text-sm flex-shrink-0 ml-2 ${
                        record.type === "Ingreso" ? "text-success" : "text-white"
                      }`}
                    >
                      {record.type === "Ingreso" ? "+" : "-"}$
                      {Math.abs(record.amount).toLocaleString("es-CL")}
                    </div>
                  </div>
                );
              })
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
