import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="Acompanha — início" className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-sm font-bold text-primary-foreground shadow-md shadow-brand/25">
        A
      </span>
      <span className="leading-tight">
        <span className="block text-base font-semibold text-navy">Acompanha</span>
        <span className="block text-xs text-muted-foreground">Desafios educacionais</span>
      </span>
    </Link>
  );
}
