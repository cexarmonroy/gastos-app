import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "income" | "expense" | "info" | "warning" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  income: "bg-income-soft text-income",
  expense: "bg-expense-soft text-expense",
  info: "bg-primary-soft text-info",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-surface-elevated text-muted",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
