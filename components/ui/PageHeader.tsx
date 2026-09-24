import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted text-sm md:text-base mt-1">{description}</p>}
      </div>
      {actions && <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">{actions}</div>}
    </div>
  );
}
