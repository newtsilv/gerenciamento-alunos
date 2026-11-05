import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface text-muted-foreground border-border",
  info: "bg-brand-soft text-brand border-brand/15",
  success: "bg-success-soft text-success border-success/15",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/15",
};

export function StatusBadge({ tone = "neutral", children, className, dot, icon }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" />}
      {icon && <span className="flex shrink-0 [&>svg]:size-3">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}
