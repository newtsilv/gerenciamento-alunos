import { StaggerItem } from "@/components/shared/motion";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tone } from "./status-badge";

const iconTone: Record<Tone, string> = {
  neutral: "bg-surface text-muted-foreground",
  info: "bg-brand-soft text-brand",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "info",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <StaggerItem
      className={cn(
        "flex items-start justify-between gap-3 rounded-2xl border bg-card p-4 sm:p-5 transition-shadow duration-300 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)]",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-[1.75rem] leading-tight font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl max-sm:hidden", iconTone[tone])}>
          <Icon className="size-5" />
        </span>
      )}
    </StaggerItem>
  );
}
