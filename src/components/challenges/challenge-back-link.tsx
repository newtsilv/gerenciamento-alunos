"use client";

import { usePathname } from "next/navigation";
import { BackLink } from "@/components/shared/back-link";

/** Tela "pai" usada quando não há tela anterior (ex.: link aberto direto). */
export function parentOf(pathname: string, challengeId: string): string {
  const base = `/desafios/${challengeId}`;
  const rest = pathname.slice(base.length).split("/").filter(Boolean);
  if (rest[0] === "acompanhamentos" && rest.length === 3) return `${base}/acompanhamentos/${rest[1]}`; // avaliação → dia
  if (rest[0] === "acompanhamentos") return base; // dia → escolher dia
  if (rest[0] === "equipes" && rest.length >= 2) return `${base}/equipes`; // equipe/importar → equipes
  if (rest[0] === "historico") return `${base}/resultados`;
  if (rest[0] === "criterios") return `${base}/configuracoes`;
  return "/desafios";
}

export function ChallengeBackLink({ challengeId }: { challengeId: string }) {
  const pathname = usePathname();
  return <BackLink fallback={parentOf(pathname, challengeId)} />;
}
