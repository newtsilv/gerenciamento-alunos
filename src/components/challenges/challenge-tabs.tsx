"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChallengeTabs({ challengeId, canManage }: { challengeId: string; canManage: boolean }) {
  const pathname = usePathname();
  const base = `/desafios/${challengeId}`;
  const tabs = [
    { label: "Acompanhar", href: base, match: [base, `${base}/acompanhamentos`], exactFirst: true },
    { label: "Equipes", href: `${base}/equipes`, match: [`${base}/equipes`] },
    { label: "Resultados", href: `${base}/resultados`, match: [`${base}/resultados`, `${base}/historico`] },
  ];

  const isActive = (t: (typeof tabs)[number]) =>
    t.match.some((m, i) => (i === 0 && t.exactFirst ? pathname === m : pathname === m || pathname.startsWith(`${m}/`)));
  const settingsActive = pathname.startsWith(`${base}/configuracoes`) || pathname.startsWith(`${base}/criterios`);

  // depois de escolher o dia, as outras seções só distraem; o "Voltar" do cabeçalho continua disponível
  if (pathname.startsWith(`${base}/acompanhamentos/`)) return null;

  return (
    <nav className="scrollbar-thin relative -mx-4 mb-4 flex sm:mb-6 items-center overflow-x-auto border-b px-2 sm:mx-0 sm:px-0" aria-label="Seções do desafio">
      <ul className="flex min-w-max flex-1 sm:gap-1">
        {tabs.map((t) => {
          const active = isActive(t);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center px-2 text-sm transition-colors sm:px-3 sm:text-[0.9375rem]",
                  active ? "font-medium text-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {active && <span className="absolute inset-x-1.5 -bottom-px h-0.5 animate-grow-x rounded-full bg-brand" />}
              </Link>
            </li>
          );
        })}
      </ul>
      {canManage && (
        <Link
          href={`${base}/configuracoes`}
          aria-current={settingsActive ? "page" : undefined}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors sm:ml-2 sm:px-3",
            settingsActive ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:bg-surface hover:text-foreground",
          )}
        >
          <SettingsIcon className="size-4" aria-hidden />
          <span className="sr-only sm:hidden">Configurações</span>
          <span className="max-sm:hidden">Configurações</span>
        </Link>
      )}
    </nav>
  );
}
