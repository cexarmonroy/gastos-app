import type { ReactNode } from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerVariant = "info" | "warning" | "error" | "success";

const variantConfig: Record<BannerVariant, { icon: typeof Info; classes: string; role: "status" | "alert" }> = {
  info: { icon: Info, classes: "bg-primary-soft border-primary/20 text-info", role: "status" },
  warning: { icon: AlertTriangle, classes: "bg-warning-soft border-warning/20 text-warning", role: "status" },
  error: { icon: AlertCircle, classes: "bg-expense-soft border-expense/20 text-expense", role: "alert" },
  success: { icon: CheckCircle2, classes: "bg-income-soft border-income/20 text-income", role: "status" },
};

interface BannerProps {
  variant: BannerVariant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Banner({ variant, title, children, action, className }: BannerProps) {
  const { icon: Icon, classes, role } = variantConfig[variant];
  return (
    <div role={role} className={cn("flex items-start gap-3 border rounded-lg p-3 text-sm", classes, className)}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="text-foreground/90">{children}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}
