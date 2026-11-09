"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isEvaluationPath } from "@/components/layout/nav-config";

/** Cabeçalho e abas do desafio: saem de cena no celular durante o registro de uma equipe. */
export function ChallengeChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className={isEvaluationPath(pathname) ? "max-md:hidden" : undefined}>{children}</div>;
}
