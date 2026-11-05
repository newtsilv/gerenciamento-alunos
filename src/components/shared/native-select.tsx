import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Select nativo: rápido, acessível e com ótimo comportamento em celulares. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select"> & { wrapperClassName?: string }>(
  function NativeSelect({ className, wrapperClassName, children, ...props }, ref) {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border border-input bg-card pr-8 pl-3 text-sm transition-colors outline-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  },
);
