"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, HardHat } from "lucide-react";
import { fetchProjects } from "@/app/actions/projects";
import { ProjectModal } from "@/components/ui/ProjectModal";
import {
  ProjectFundingBadge,
  ProjectFundingHeadline,
  ProjectFundingSummary,
} from "@/components/projects/ProjectFundingSummary";
import { PROJECT_STATUS_LABELS } from "@/lib/finance/project-labels";
import type { ProjectSummary } from "@/lib/finance/types";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canManage =
    session?.user?.role === "ADMIN" || session?.user?.role === "DIRECTIVA";

  const loadProjects = () => {
    setIsLoading(true);
    fetchProjects()
      .then(setProjects)
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const formatMoney = (n: number) =>
    "$" + n.toLocaleString("es-CL", { maximumFractionDigits: 0 });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Proyectos</h1>
          <p className="text-white/60 text-sm md:text-base">
            Inversiones del Fondo de Ahorro: con recaudación o ejecución con saldo acumulado.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 w-full md:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            Nuevo proyecto
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="glass-panel p-12 text-center text-white/50">Cargando proyectos...</div>
      ) : projects.length === 0 ? (
        <div className="glass-panel p-16 text-center">
          <HardHat className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="text-white/50 mb-4">No hay proyectos registrados</p>
          {canManage && (
            <button onClick={() => setIsModalOpen(true)} className="btn-primary">
              Crear primer proyecto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="glass-panel p-5 hover:border-accent/40 border border-transparent transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg group-hover:text-accent transition-colors">
                    {project.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-white/40">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                    <ProjectFundingBadge fundingMode={project.fundingMode} />
                  </div>
                </div>
                <ProjectFundingHeadline
                  fundingMode={project.fundingMode}
                  progress={project.progress}
                  executionProgress={project.executionProgress}
                />
              </div>

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

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-success/10 rounded-lg p-2 border border-success/20">
                  <p className="text-white/50">Ingresos</p>
                  <p className="font-bold text-success font-mono">{formatMoney(project.totalIncome)}</p>
                </div>
                <div className="bg-danger/10 rounded-lg p-2 border border-danger/20">
                  <p className="text-white/50">Gastos</p>
                  <p className="font-bold text-danger font-mono">{formatMoney(project.totalExpense)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                  <p className="text-white/50">Saldo</p>
                  <p className={`font-bold font-mono ${project.balance >= 0 ? "text-success" : "text-danger"}`}>
                    {formatMoney(project.balance)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadProjects}
      />
    </div>
  );
}
