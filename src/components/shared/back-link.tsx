"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { hasPreviousScreen } from "@/components/layout/navigation-history";
import { cn } from "@/lib/utils";

/**
 * "‹ Voltar": retorna à tela anterior (como o botão do navegador).
 * Se a pessoa chegou direto por um link, vai para `fallback` (a tela "pai").
 */
export function BackLink({ fallback, label = "Voltar", className }: { fallback: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallback}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // abrir em nova aba continua funcionando
        if (hasPreviousScreen()) {
          e.preventDefault();
          router.back();
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-brand",
        className,
      )}
    >
      <ChevronLeftIcon className="size-4" />
      {label}
    </Link>
  );
}
