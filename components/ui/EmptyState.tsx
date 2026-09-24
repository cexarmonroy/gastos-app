import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="glass-panel p-12 text-center">
      <Icon className="w-10 h-10 mx-auto mb-4 text-subtle" />
      <p className="font-medium text-foreground mb-1">{title}</p>
      {description && <p className="text-muted text-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
