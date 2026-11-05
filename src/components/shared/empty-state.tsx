import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex animate-fade-in flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center", className)}>
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="size-6" />
      </span>
      <h3 className="font-medium">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
