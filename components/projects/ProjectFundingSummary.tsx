import {
  isFundraisingProject,
  PROJECT_FUNDING_MODE_LABELS,
} from "@/lib/finance/project-labels";
import type { ProjectFundingMode } from "@/lib/finance/types";

interface ProjectFundingSummaryProps {
  fundingMode: ProjectFundingMode;
  targetAmount: number;
  totalIncome: number;
  totalExpense: number;
  progress: number | null;
  executionProgress: number | null;
  formatMoney: (amount: number) => string;
  compact?: boolean;
}

export function ProjectFundingSummary({
  fundingMode,
  targetAmount,
  totalIncome,
  totalExpense,
  progress,
  executionProgress,
  formatMoney,
  compact = false,
}: ProjectFundingSummaryProps) {
  const isFundraising = isFundraisingProject(fundingMode);

  if (isFundraising) {
    const barProgress = progress ?? 0;
    return (
      <div className={compact ? "mb-3" : "mb-4"}>
        <div className="flex justify-between text-[10px] text-white/40 mb-1">
          <span>Asignado: {formatMoney(totalIncome)}</span>
          <span>Meta: {formatMoney(targetAmount)}</span>
        </div>
        <div className={`${compact ? "h-2" : "h-3"} bg-white/10 rounded-full overflow-hidden`}>
          <div
            className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-500"
            style={{ width: `${barProgress}%` }}
          />
        </div>
        {!compact && (
          <p className="text-white/30 text-[10px] mt-2">
            Avance de recaudación según ingresos vinculados al proyecto.
          </p>
        )}
      </div>
    );
  }

  const barProgress = executionProgress ?? 0;
  return (
    <div className={compact ? "mb-3" : "mb-4"}>
      <div className="flex justify-between text-[10px] text-white/40 mb-1">
        <span>Ejecutado: {formatMoney(totalExpense)}</span>
        <span>Presupuesto: {formatMoney(targetAmount)}</span>
      </div>
      <div className={`${compact ? "h-2" : "h-3"} bg-white/10 rounded-full overflow-hidden`}>
        <div
          className="h-full bg-gradient-to-r from-danger/80 to-danger rounded-full transition-all duration-500"
          style={{ width: `${barProgress}%` }}
        />
      </div>
      {!compact && (
        <p className="text-white/30 text-[10px] mt-2">
          Inversión pagada con saldo del Fondo de Ahorro; no requiere recaudación hacia la meta.
        </p>
      )}
    </div>
  );
}

export function ProjectFundingBadge({ fundingMode }: { fundingMode: ProjectFundingMode }) {
  const isFundraising = isFundraisingProject(fundingMode);
  return (
    <span
      className={`text-[10px] uppercase tracking-wider ${
        isFundraising ? "text-accent" : "text-white/40"
      }`}
    >
      {PROJECT_FUNDING_MODE_LABELS[fundingMode]}
    </span>
  );
}

export function ProjectFundingHeadline({
  fundingMode,
  progress,
  executionProgress,
}: {
  fundingMode: ProjectFundingMode;
  progress: number | null;
  executionProgress: number | null;
}) {
  if (isFundraisingProject(fundingMode)) {
    return <span className="text-sm font-bold text-accent">{progress ?? 0}%</span>;
  }
  return (
    <span className="text-sm font-bold text-danger">{executionProgress ?? 0}% ejecutado</span>
  );
}
