import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  variation?: { label: string; direction: "up" | "down" };
  href?: string;
  linkLabel?: string;
  hero?: boolean;
  className?: string;
}

export function KpiCard({ label, value, variation, href, linkLabel, hero, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        "glass-panel p-5 md:p-6 flex flex-col justify-between",
        hero && "bg-primary text-white",
        className
      )}
    >
      <p className={cn("text-sm font-medium mb-1", hero ? "text-white/70" : "text-muted")}>{label}</p>
      <p className={cn("font-bold tabular-nums break-words", hero ? "text-3xl md:text-4xl" : "text-2xl")}>
        {value}
      </p>
      {variation && (
        <p
          className={cn(
            "text-xs mt-2 font-medium flex items-center gap-1",
            variation.direction === "up" ? "text-income" : "text-expense"
          )}
        >
          {variation.direction === "up" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )}
          {variation.label}
        </p>
      )}
      {href && linkLabel && (
        <Link
          href={href}
          className={cn(
            "text-xs font-medium mt-3 hover:underline",
            hero ? "text-white/80" : "text-primary"
          )}
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
