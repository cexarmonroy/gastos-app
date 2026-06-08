"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Plus, Pencil, Target, TrendingUp, TrendingDown } from "lucide-react";
import { getProjectDetail } from "@/app/actions/projects";
import { ProjectModal } from "@/components/ui/ProjectModal";
import { RecordModal } from "@/components/ui/RecordModal";
import {
  ProjectFundingBadge,
  ProjectFundingSummary,
} from "@/components/projects/ProjectFundingSummary";
import { isFundraisingProject, PROJECT_STATUS_LABELS } from "@/lib/finance/project-labels";
import type { MovementRecord, ProjectSummary } from "@/lib/finance/types";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState<
    (ProjectSummary & { movements: MovementRecord[] }) | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  const canManage =
    session?.user?.role === "ADMIN" || session?.user?.role === "DIRECTIVA";

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const loadProject = () => {
    if (!projectId) return;
    setIsLoading(true);
    getProjectDetail(projectId)
      .then(setProject)
      .catch(() => setProject(null))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const formatMoney = (n: number) =>
    "$" + n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

  if (isLoading) {
    return <div className="glass-panel p-12 text-center text-white/50">Cargando...</div>;
  }

  if (!project) {
    return (
      <div className="glass-panel p-12 text-center">
        <p className="text-white/50 mb-4">Proyecto no encontrado</p>
        <Link href="/projects" className="btn-secondary">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a proyectos
      </Link>

      <div className="mb-6 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold">{project.name}</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent border border-accent/30">
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-white/60 border border-white/10">
              <ProjectFundingBadge fundingMode={project.fundingMode} />
            </span>
          </div>
          {project.description && (
            <p className="text-white/60 text-sm">{project.description}</p>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsProjectModalOpen(true)}
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
              Asignar fondos
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel p-5 mb-6">
        <p className="text-white/50 text-sm mb-1">
          {isFundraisingProject(project.fundingMode)
            ? "Avance hacia la meta"
            : "Ejecución del presupuesto"}
        </p>
        <p
          className={`text-3xl font-bold mb-4 ${
            isFundraisingProject(project.fundingMode) ? "text-accent" : "text-danger"
          }`}
        >
          {isFundraisingProject(project.fundingMode)
            ? `${project.progress ?? 0}%`
            : `${project.executionProgress ?? 0}%`}
        </p>
        <ProjectFundingSummary
          fundingMode={project.fundingMode}
          targetAmount={project.targetAmount}
          totalIncome={project.totalIncome}
          totalExpense={project.totalExpense}
          progress={project.progress}
          executionProgress={project.executionProgress}
          formatMoney={formatMoney}
          compact
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-panel p-5">
          <TrendingUp className="w-5 h-5 text-success mb-2" />
          <p className="text-white/50 text-sm">Fondos asignados</p>
          <p className="text-2xl font-bold text-success">{formatMoney(project.totalIncome)}</p>
        </div>
        <div className="glass-panel p-5">
          <TrendingDown className="w-5 h-5 text-danger mb-2" />
          <p className="text-white/50 text-sm">Gastos del proyecto</p>
          <p className="text-2xl font-bold text-danger">{formatMoney(project.totalExpense)}</p>
        </div>
        <div className="glass-panel p-5">
          <Target className="w-5 h-5 text-primary mb-2" />
          <p className="text-white/50 text-sm">Saldo disponible</p>
          <p className={`text-2xl font-bold ${project.balance >= 0 ? "text-success" : "text-danger"}`}>
            {formatMoney(project.balance)}
          </p>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold">Movimientos vinculados ({project.movements.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase bg-[#0f1115] text-white/60">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {project.movements.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-white/40">
                    {isFundraisingProject(project.fundingMode)
                      ? "Vincula ingresos del Fondo de Ahorro para avanzar hacia la meta."
                      : "Vincula egresos del Fondo de Ahorro para registrar la inversión."}
                  </td>
                </tr>
              ) : (
                project.movements.map((m) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 text-white/70">
                      {format(new Date(m.date), "dd/MM/yyyy", { locale: es })}
                    </td>
                    <td className="px-4 py-3">{m.description || "—"}</td>
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

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSaved={loadProject}
        project={project}
      />

      <RecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSaved={loadProject}
        defaultProjectId={project.id}
        defaultFund="fondo_ahorro"
      />
    </div>
  );
}
