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
  Flag,
  Receipt,
  ArrowRight,
} from "lucide-react";
import {
  fetchMovementsData,
  fetchRecentMovements,
  getFundBalances,
  getFundBalancesAsOf,
} from "@/app/actions/movements";
import { fetchProjects } from "@/app/actions/projects";
import { fetchEvents } from "@/app/actions/events";
import { buildCategoryBreakdown } from "@/lib/finance/category-breakdown";
import {
  buildBalanceChartData,
  buildFlowChartData,
  buildWeeklyFlowData,
  buildWeeklyInsight,
} from "@/lib/finance/chart-data";
import {
  getMovementDisplayLabel,
  getMovementSubtitle,
} from "@/lib/finance/movement-label";
import {
  getPeriodBounds,
  getPeriodLabel,
  getPreviousPeriodBounds,
  sumExpense,
  sumIncome,
  type DashboardPeriod,
} from "@/lib/finance/period-filter";
import { computeMetric } from "@/lib/finance/period-comparison";
import { computeActivityRoi } from "@/lib/finance/report-period-comparison";
import type { EventSummary, FundTab, MovementRecord, ProjectSummary } from "@/lib/finance/types";
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
  BarChart,
  Bar,
} from "recharts";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatCalendarDate } from "@/lib/date-only";
import Link from "next/link";

type ChartMode = "flow" | "balance";

export default function DashboardPage() {
  const [periodRecords, setPeriodRecords] = useState<MovementRecord[]>([]);
  const [recentMovements, setRecentMovements] = useState<MovementRecord[]>([]);
  const [fundBalances, setFundBalances] = useState({ caja_chica: 0, fondo_ahorro: 0 });
  const [previousSaldoTotal, setPreviousSaldoTotal] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [categoryFundFilter, setCategoryFundFilter] = useState<FundTab | "all">("all");
  const [chartMode, setChartMode] = useState<ChartMode>("flow");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El historial completo solo se necesita para "Evolución del Saldo", así que
  // se carga bajo demanda la primera vez que se selecciona esa vista.
  const [balanceHistory, setBalanceHistory] = useState<MovementRecord[] | null>(null);
  const [isLoadingBalanceHistory, setIsLoadingBalanceHistory] = useState(false);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      setError(null);

      const bounds = getPeriodBounds(period);
      const previousBounds = getPreviousPeriodBounds(period);
      const [movements, recent, balances, previousBalances, projectList, eventList] = await Promise.all([
        fetchMovementsData(
          bounds ? { dateFrom: bounds.start.toISOString(), dateTo: bounds.end.toISOString() } : undefined
        ),
        fetchRecentMovements(6),
        getFundBalances(),
        previousBounds ? getFundBalancesAsOf(previousBounds.end.toISOString()) : Promise.resolve(null),
        fetchProjects(),
        fetchEvents(),
      ]);

      setPeriodRecords(movements);
      setRecentMovements(recent);
      setFundBalances(balances);
      setPreviousSaldoTotal(
        previousBalances ? previousBalances.caja_chica + previousBalances.fondo_ahorro : null
      );
      setProjects(projectList);
      setEvents(eventList);
      setLastUpdate(new Date());

      // Solo se refresca el historial completo en un refresh explícito (no en
      // cada cambio de período, ya que "Evolución del Saldo" no depende de él).
      if (isRefresh && balanceHistory !== null) {
        fetchMovementsData().then(setBalanceHistory);
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    if (chartMode !== "balance" || balanceHistory !== null || isLoadingBalanceHistory) return;
    setIsLoadingBalanceHistory(true);
    fetchMovementsData()
      .then(setBalanceHistory)
      .finally(() => setIsLoadingBalanceHistory(false));
  }, [chartMode, balanceHistory, isLoadingBalanceHistory]);

  const periodLabel = getPeriodLabel(period);

  const totalCajaChica = fundBalances.caja_chica;
  const totalFondoAhorro = fundBalances.fondo_ahorro;
  const saldoTotal = totalCajaChica + totalFondoAhorro;

  const periodIngresos = sumIncome(periodRecords);
  const periodEgresos = sumExpense(periodRecords);
  const periodResultado = periodIngresos - periodEgresos;

  const categoryFundRecords = useMemo(
    () =>
      categoryFundFilter === "all"
        ? periodRecords
        : periodRecords.filter((r) => r.category === categoryFundFilter),
    [periodRecords, categoryFundFilter]
  );

  const expenseBreakdown = useMemo(
    () =>
      buildCategoryBreakdown(categoryFundRecords.filter((r) => r.type === "Egreso")).slice(0, 5),
    [categoryFundRecords]
  );
  const incomeBreakdown = useMemo(
    () =>
      buildCategoryBreakdown(categoryFundRecords.filter((r) => r.type === "Ingreso")).slice(0, 5),
    [categoryFundRecords]
  );

  const flowChartData = useMemo(
    () => buildFlowChartData(periodRecords, period),
    [periodRecords, period]
  );
  const balanceChartData = useMemo(
    () => buildBalanceChartData(balanceHistory ?? []),
    [balanceHistory]
  );

  const weeklyFlowData = useMemo(
    () => (period === "month" ? buildWeeklyFlowData(periodRecords) : []),
    [periodRecords, period]
  );
  const weeklyInsight = useMemo(() => buildWeeklyInsight(weeklyFlowData), [weeklyFlowData]);

  const saldoComparison = useMemo(() => {
    if (previousSaldoTotal === null) return null;
    return computeMetric(saldoTotal, previousSaldoTotal, true);
  }, [saldoTotal, previousSaldoTotal]);

  const priorityProject = useMemo(() => {
    const fundraising = projects.filter((p) => p.fundingMode === "FUNDRAISING");
    const active = fundraising.filter((p) => p.status === "IN_PROGRESS");
    const pool = active.length > 0 ? active : fundraising.filter((p) => p.status === "PLANNED");
    if (pool.length === 0) return fundraising[0] ?? null;
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

  const latestEventRoi = useMemo(
    () => (latestEvent ? computeActivityRoi(latestEvent.profit, latestEvent.totalExpense) : null),
    [latestEvent]
  );

  const formatM = (val: number) =>
    "$" + val.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const buildCategoryRecordsHref = (categoryId: string | null, type: "Ingreso" | "Egreso") => {
    const params = new URLSearchParams();
    params.set("type", type === "Ingreso" ? "ingreso" : "egreso");
    if (categoryId) params.set("category", categoryId);
    if (categoryFundFilter !== "all") params.set("fund", categoryFundFilter);
    const bounds = getPeriodBounds(period);
    if (bounds) {
      params.set("from", format(bounds.start, "yyyy-MM-dd"));
      params.set("to", format(bounds.end, "yyyy-MM-dd"));
    }
    return `/records?${params.toString()}`;
  };

  const showWeeklyBreakdown = !isLoading && period === "month" && weeklyFlowData.length > 0;
  const showLatestEvent = !isLoading && !!latestEvent;

  const saldoSubtitle =
    saldoComparison && saldoComparison.hasPreviousData && saldoComparison.deltaPercent !== null
      ? `${saldoComparison.deltaPercent > 0 ? "+" : ""}${saldoComparison.deltaPercent}% vs ${
          period === "year" ? "año anterior" : "mes anterior"
        }`
      : undefined;

  const positionStats = [
    {
      title: "Saldo Total",
      amount: isLoading ? "Cargando..." : formatM(saldoTotal),
      icon: <Wallet className="w-6 h-6 text-primary" />,
      trend: "Posición actual",
      hint: "Suma de Caja Chica y Fondo de Ahorro",
      subtitle: saldoSubtitle,
      subtitleClass:
        saldoComparison?.direction === "down" ? "text-danger" : "text-success",
      accentClass: "bg-primary",
    },
    {
      title: "Caja Chica",
      amount: isLoading ? "Cargando..." : formatM(totalCajaChica),
      icon: <Briefcase className="w-6 h-6 text-success" />,
      trend: "Posición actual",
      hint: "Saldo acumulado en Caja Chica",
      subtitle: undefined as string | undefined,
      subtitleClass: "",
      accentClass: "bg-accent",
    },
    {
      title: "Fondo de Ahorro",
      amount: isLoading ? "Cargando..." : formatM(totalFondoAhorro),
      icon: <PiggyBank className="w-6 h-6 text-accent" />,
      trend: "Posición actual",
      hint: "Saldo acumulado en Fondo de Ahorro",
      subtitle: undefined as string | undefined,
      subtitleClass: "",
      accentClass: "bg-warning",
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
          <p className="text-muted text-sm md:text-base">
            Posición actual de fondos y resultado del período seleccionado
          </p>
          {lastUpdate && (
            <p className="text-muted text-xs md:text-sm mt-1">
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
        <p className="text-muted text-xs font-medium uppercase tracking-wider">
          Posición actual
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        {positionStats.map((stat) => (
          <div
            key={stat.title}
            className="glass-panel p-4 md:p-6 flex flex-col hover:-translate-y-1 transition-transform duration-300 relative group overflow-hidden"
            title={stat.hint}
          >
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${stat.accentClass}`} />
            <div className="flex items-start justify-between mb-3 md:mb-4">
              <div className="p-2 md:p-3 bg-surface-elevated rounded-xl border border-border">
                <div className="w-5 h-5 md:w-6 md:h-6">{stat.icon}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-1.5 md:px-2 py-0.5 md:py-1 rounded-md text-[10px] md:text-xs font-medium bg-surface-elevated text-muted">
                  {stat.trend}
                </div>
                <Info className="w-3 h-3 md:w-4 md:h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
              </div>
            </div>
            <div>
              <p className="text-muted text-xs md:text-sm font-medium mb-1">{stat.title}</p>
              <h3 className="text-xl md:text-2xl font-bold break-words">{stat.amount}</h3>
              {stat.subtitle && (
                <p className={`text-xs mt-1 font-medium ${stat.subtitleClass}`}>{stat.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Resultado del período */}
      <div className="mb-2">
        <p className="text-muted text-xs font-medium uppercase tracking-wider">
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
            <p className="text-muted text-xs md:text-sm font-medium mb-1">{stat.title}</p>
            <h3 className={`text-xl md:text-2xl font-bold break-words ${stat.amountClass}`}>
              {stat.amount}
            </h3>
            {stat.subtitle && (
              <p className="text-muted text-xs mt-1">{stat.subtitle}</p>
            )}
          </div>
        ))}
      </div>

      {/* Desglose semanal + Actividad Emblemática, lado a lado como en la maqueta */}
      {(showWeeklyBreakdown || showLatestEvent) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 mb-6 md:mb-8">
          {showWeeklyBreakdown && (
        <div className={`glass-panel p-4 md:p-6 ${showLatestEvent ? "lg:col-span-7" : "lg:col-span-12"}`}>
          <p className="text-muted text-xs font-semibold uppercase tracking-wider mb-1">
            Desglose Semanal
          </p>
          <h3 className="text-lg font-semibold mb-4">Flujo de Movimientos ({periodLabel})</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(15,23,42,0.35)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="rgba(15,23,42,0.35)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", color: "#0f172a" }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString("es-CL")}`, "Volumen"]}
                />
                <Bar dataKey="total" name="Volumen" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {weeklyInsight && (
            <p className="text-muted text-xs mt-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              {weeklyInsight.weekLabel} concentró el {weeklyInsight.percent}% del volumen transaccional del período.
            </p>
          )}
            </div>
          )}
          {showLatestEvent && latestEvent && (
            <div className={`glass-panel p-4 md:p-6 flex flex-col ${showWeeklyBreakdown ? "lg:col-span-5" : "lg:col-span-12"}`}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 text-primary text-xs font-bold">
                  <Flag className="w-3.5 h-3.5" />
                  Actividad Emblemática
                </span>
                <span className="text-muted text-xs font-medium">
                  {formatCalendarDate(latestEvent.date, "dd 'de' MMMM", { locale: es })}
                </span>
              </div>

              <h3 className="text-xl font-bold text-primary mb-1">{latestEvent.name}</h3>
              {latestEvent.description && (
                <p className="text-muted text-sm mb-4 line-clamp-2">{latestEvent.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-success/10 rounded-xl p-3">
                  <p className="text-muted text-xs font-medium mb-1">Recaudación Bruta</p>
                  <p className="text-lg font-bold text-success font-mono break-words">
                    {formatM(latestEvent.totalIncome)}
                  </p>
                </div>
                <div className="bg-danger/10 rounded-xl p-3">
                  <p className="text-muted text-xs font-medium mb-1">Costos Directos</p>
                  <p className="text-lg font-bold text-danger font-mono break-words">
                    -{formatM(latestEvent.totalExpense)}
                  </p>
                </div>
              </div>

              <div className="bg-surface-elevated rounded-xl p-3 flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <PiggyBank className="w-5 h-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted text-xs font-medium">Ganancia Neta</p>
                    <p
                      className={`font-bold font-mono truncate ${
                        latestEvent.profit >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {formatM(latestEvent.profit)}
                    </p>
                  </div>
                </div>
                {latestEventRoi !== null && (
                  <span
                    className={`text-xs font-bold whitespace-nowrap ${
                      latestEventRoi >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    Margen {latestEventRoi}%
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 flex-wrap">
                <span className="text-muted text-xs flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  {latestEvent.movementCount} movimientos registrados
                </span>
                <Link
                  href={`/events/${latestEvent.id}`}
                  className="btn-secondary text-xs md:text-sm px-3 md:px-4 py-2 flex items-center gap-1.5"
                >
                  Ver Rendición Detallada
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top categorías del período */}
      {!isLoading && periodRecords.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <p className="text-muted text-xs font-medium uppercase tracking-wider">
              Top categorías del período
            </p>
            <select
              value={categoryFundFilter}
              onChange={(e) => setCategoryFundFilter(e.target.value as FundTab | "all")}
              className="select-premium py-1.5 text-xs w-auto"
            >
              <option value="all">Ambos fondos</option>
              <option value="caja_chica">Solo Caja Chica</option>
              <option value="fondo_ahorro">Solo Fondo de Ahorro</option>
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-1">Top Ingresos por Categoría</h3>
            <p className="text-muted text-xs mb-4">
              {periodLabel} · haz clic en una categoría para ver el detalle
            </p>
            <div className="space-y-1">
              {incomeBreakdown.length === 0 ? (
                <p className="text-muted text-sm">Sin datos en este período</p>
              ) : (
                incomeBreakdown.map((item) => (
                  <Link
                    key={item.categoryId ?? item.categoryName}
                    href={buildCategoryRecordsHref(item.categoryId, "Ingreso")}
                    className="flex justify-between items-center text-sm px-2 py-1.5 -mx-2 rounded-lg hover:bg-surface-elevated transition-colors group"
                  >
                    <span className="text-foreground/80 group-hover:text-foreground">
                      {item.categoryName}
                      <span className="text-muted text-xs ml-1.5">
                        · {item.count} {item.count === 1 ? "movimiento" : "movimientos"}
                      </span>
                    </span>
                    <span className="text-success font-semibold font-mono flex-shrink-0 ml-2">
                      ${item.total.toLocaleString("es-CL")}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
          <div className="glass-panel p-4 md:p-6">
            <h3 className="text-lg font-semibold mb-1">Top Gastos por Categoría</h3>
            <p className="text-muted text-xs mb-4">
              {periodLabel} · haz clic en una categoría para ver el detalle
            </p>
            <div className="space-y-1">
              {expenseBreakdown.length === 0 ? (
                <p className="text-muted text-sm">Sin datos en este período</p>
              ) : (
                expenseBreakdown.map((item) => (
                  <Link
                    key={item.categoryId ?? item.categoryName}
                    href={buildCategoryRecordsHref(item.categoryId, "Egreso")}
                    className="flex justify-between items-center text-sm px-2 py-1.5 -mx-2 rounded-lg hover:bg-surface-elevated transition-colors group"
                  >
                    <span className="text-foreground/80 group-hover:text-foreground">
                      {item.categoryName}
                      <span className="text-muted text-xs ml-1.5">
                        · {item.count} {item.count === 1 ? "movimiento" : "movimientos"}
                      </span>
                    </span>
                    <span className="text-danger font-semibold font-mono flex-shrink-0 ml-2">
                      ${item.total.toLocaleString("es-CL")}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
          </div>
        </>
      )}

      {/* Proyecto Prioritario */}
      {!isLoading && priorityProject && (
        <div className="glass-panel p-4 md:p-6 mb-6 md:mb-8 max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <HardHat className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Proyecto Prioritario</h3>
          </div>
          <p className="text-xl font-bold mb-1">{priorityProject.name}</p>
          <p className="text-muted text-sm mb-4">
            {priorityProject.fundingMode === "EXECUTION" ? "Presupuesto" : "Meta"}:{" "}
            {formatM(priorityProject.targetAmount)}
          </p>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted">
              {priorityProject.fundingMode === "EXECUTION" ? "Ejecutado" : "Avance"}
            </span>
            <span className="font-semibold">
              {priorityProject.fundingMode === "EXECUTION"
                ? `${priorityProject.executionProgress ?? 0}%`
                : `${priorityProject.progress ?? 0}%`}
            </span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${
                priorityProject.fundingMode === "EXECUTION" ? "bg-danger" : "bg-primary"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  priorityProject.fundingMode === "EXECUTION"
                    ? (priorityProject.executionProgress ?? 0)
                    : (priorityProject.progress ?? 0)
                )}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">
              {priorityProject.fundingMode === "EXECUTION"
                ? `Gastado: ${formatM(priorityProject.totalExpense)}`
                : `Actual: ${formatM(priorityProject.totalIncome)}`}
            </span>
            <Link href={`/projects/${priorityProject.id}`} className="text-primary hover:underline">
              Ver proyecto →
            </Link>
          </div>
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
              <p className="text-muted text-xs mt-0.5">
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
            {isLoading || (chartMode === "balance" && isLoadingBalanceHistory) ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-muted animate-pulse">Cargando gráfico...</p>
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
                    stroke="rgba(15,23,42,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(15,23,42,0.35)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="rgba(15,23,42,0.35)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `$${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e2e8f0",
                      borderRadius: "12px",
                      color: "#0f172a",
                    }}
                    itemStyle={{ color: "#0f172a" }}
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
                    stroke="rgba(15,23,42,0.08)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(15,23,42,0.35)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="rgba(15,23,42,0.35)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `$${value >= 1000 ? (value / 1000).toFixed(0) + "k" : value}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderColor: "#e2e8f0",
                      borderRadius: "12px",
                      color: "#0f172a",
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
                <p className="text-muted">No hay datos suficientes para el gráfico</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel p-4 md:p-6 flex flex-col min-h-[300px] md:min-h-[400px]">
          <h3 className="text-lg md:text-xl font-semibold mb-4 md:mb-6">Actividad Reciente</h3>
          <div className="flex-1 flex flex-col gap-3 md:gap-4 mb-4 overflow-y-auto pr-2 custom-scrollbar">
            {isLoading ? (
              <p className="text-muted text-sm text-center my-auto animate-pulse">Cargando...</p>
            ) : recentMovements.length > 0 ? (
              recentMovements.map((record) => {
                const label = getMovementDisplayLabel(record);
                const subtitle = getMovementSubtitle(record);
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-border/40 transition-colors border border-border"
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
                        <p className="text-sm font-medium text-foreground truncate" title={label}>
                          {label}
                        </p>
                        <p className="text-xs text-muted truncate">
                          {subtitle
                            ? `${subtitle} · `
                            : ""}
                          {record.date
                            ? formatCalendarDate(record.date, "dd MMM yyyy", { locale: es })
                            : "Fecha inválida"}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`font-semibold text-sm flex-shrink-0 ml-2 ${
                        record.type === "Ingreso" ? "text-success" : "text-foreground"
                      }`}
                    >
                      {record.type === "Ingreso" ? "+" : "-"}$
                      {Math.abs(record.amount).toLocaleString("es-CL")}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-muted text-sm text-center my-auto">Sin registros recientes</p>
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
