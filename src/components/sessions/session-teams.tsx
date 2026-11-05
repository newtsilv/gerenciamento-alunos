"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, SearchIcon, UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/shared/native-select";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { TEAM_SESSION_STATE, type TeamSessionState } from "@/lib/domain/constants";
import { formatAverage } from "@/lib/domain/scores";
import { cn } from "@/lib/utils";

export type SessionTeam = {
  id: string;
  name: string;
  project_title: string;
  monitorId: string | null;
  monitorName: string | null;
  evaluatorName: string | null;
  state: TeamSessionState;
  memberCount: number;
  evaluatedStudents: number;
  average: number | null;
  attention: number;
};

const stateTone: Record<TeamSessionState, Tone> = { pendente: "neutral", em_andamento: "warning", concluido: "success" };

export function SessionTeams({
  baseHref,
  teams,
  viewerId,
  isMonitor,
}: {
  baseHref: string;
  teams: SessionTeam[];
  viewerId: string;
  isMonitor: boolean;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState(isMonitor && teams.some((t) => t.monitorId === viewerId) ? "mine" : "all");
  const [stateFilter, setStateFilter] = useState<"" | TeamSessionState>("");

  const filtered = useMemo(
    () =>
      teams.filter(
        (t) =>
          (scope === "all" || t.monitorId === viewerId) &&
          (!stateFilter || t.state === stateFilter) &&
          (!query || t.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [teams, scope, stateFilter, query, viewerId],
  );

  const counts = {
    pendente: teams.filter((t) => t.state === "pendente").length,
    em_andamento: teams.filter((t) => t.state === "em_andamento").length,
    concluido: teams.filter((t) => t.state === "concluido").length,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(counts) as TeamSessionState[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setStateFilter(stateFilter === k ? "" : k)}
            className={cn(
              "rounded-xl border bg-card p-3 text-left transition-colors",
              stateFilter === k ? "border-brand bg-brand-soft" : "hover:bg-surface",
            )}
          >
            <p className="text-xs text-muted-foreground">{TEAM_SESSION_STATE[k]}</p>
            <p className="text-xl font-semibold tabular-nums">{counts[k]}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar equipe…" className="pl-9" aria-label="Buscar equipe" />
        </div>
        <NativeSelect value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Equipes exibidas">
          <option value="mine">Minhas equipes</option>
          <option value="all">Todas as equipes</option>
        </NativeSelect>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Nenhuma equipe para exibir"
          description={scope === "mine" ? "Nenhuma equipe atribuída a você com esse filtro." : "Ajuste os filtros."}
          action={
            <button
              type="button"
              className="h-9 rounded-lg border px-3 text-sm hover:bg-surface"
              onClick={() => {
                setScope("all");
                setStateFilter("");
                setQuery("");
              }}
            >
              Mostrar todas as equipes
            </button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t, i) => (
            <li key={t.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
              <Link
                href={`${baseHref}/${t.id}`}
                className="group flex h-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-all hover:border-brand/30 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.15)] sm:flex-col sm:items-stretch sm:gap-3 sm:p-4"
              >
                <div className="flex min-w-0 flex-1 items-start justify-between gap-2 sm:flex-none">
                  <div className="min-w-0">
                    <p className="font-semibold group-hover:text-brand">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground sm:text-sm">
                      {[t.project_title || `${t.memberCount} integrante(s)`, t.monitorName && `Monitor: ${t.monitorName}`].filter(Boolean).join(" · ")}
                    </p>
                    {t.state !== "pendente" && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Alunos {t.evaluatedStudents}/{t.memberCount} · média {formatAverage(t.average)}
                        {t.attention > 0 && <span className="text-warning"> · {t.attention} em atenção</span>}
                      </p>
                    )}
                  </div>
                  <StatusBadge tone={stateTone[t.state]} dot>
                    {TEAM_SESSION_STATE[t.state]}
                  </StatusBadge>
                </div>
                <span className="mt-auto hidden items-center gap-1 text-sm font-medium text-brand sm:inline-flex">
                  {t.state === "pendente" ? "Iniciar avaliação" : t.state === "em_andamento" ? "Continuar" : "Ver / corrigir"}
                  <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground sm:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
