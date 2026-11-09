import { Stagger, StaggerItem } from "@/components/shared/motion";
import Link from "next/link";
import { ChevronRightIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { DayPicker } from "@/components/sessions/day-picker";
import { StatusBadge } from "@/components/shared/status-badge";
import { DownloadButton } from "@/components/reports/download-button";
import { requireChallengeAccess } from "@/lib/auth";
import { listSessions, listTeams } from "@/lib/data/challenges";
import { formatDate, todayISO } from "@/lib/domain/dates";

const PAGE = 10;
const UPCOMING = 2;

export default async function SessionsPage({ params, searchParams }: PageProps<"/desafios/[id]">) {
  const { id } = await params;
  const { todos } = await searchParams;
  const access = await requireChallengeAccess(id);
  const [sessions, teams] = await Promise.all([listSessions(id), listTeams(id)]);
  const today = todayISO();
  const totalTeams = teams.length;

  // dias previstos sempre aparecem; dia fora do calendário só se tiver registro (senão foi aberto por engano)
  const listed = sessions.filter((s) => !s.is_extra || s.team_evaluations.length > 0);
  const past = listed.filter((s) => s.session_date <= today).reverse();
  const future = listed.filter((s) => s.session_date > today);
  const visible = todos ? [...listed].reverse() : [...future.slice(0, UPCOMING).reverse(), ...past.slice(0, PAGE)];
  const canOpen = access.canEvaluate || access.canManage;

  if (totalTeams === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="Este desafio ainda não tem equipes"
        description={access.canManage ? "Importe a planilha com equipes e alunos para começar os acompanhamentos." : "A supervisão ainda não cadastrou as equipes."}
        action={access.canManage ? <Button render={<Link href={`/desafios/${id}/equipes/importar`} />}>Importar planilha</Button> : undefined}
      />
    );
  }

  return (
    <Stagger className="flex flex-col gap-6">
      {canOpen && (
        <StaggerItem>
        <DayPicker
          challengeId={id}
          today={today}
          scheduledDates={sessions.filter((s) => !s.is_extra && s.session_date <= today).map((s) => s.session_date)}
        />
        </StaggerItem>
      )}

      <StaggerItem as="section">
        <h2 className="mb-2 font-semibold">Dias de acompanhamento</h2>

        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum dia de acompanhamento ainda. {canOpen && "Escolha um dia acima para começar."}
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
            {visible.map((s) => {
              if (s.session_date > today) {
                return (
                  <StaggerItem as="li" key={s.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="w-28 shrink-0">
                      <p className="font-medium text-muted-foreground">{formatDate(s.session_date)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{formatDate(s.session_date, "EEEE")}</p>
                    </div>
                    <p className="min-w-0 flex-1 text-xs text-muted-foreground">Disponível para registrar no dia</p>
                    <StatusBadge className="max-sm:hidden">Previsto</StatusBadge>
                  </StaggerItem>
                );
              }
              const done = s.team_evaluations.filter((e) => e.status === "concluida").length;
              const draft = s.team_evaluations.filter((e) => e.status === "rascunho").length;
              const pct = totalTeams ? Math.round((done / totalTeams) * 100) : 0;
              const isToday = s.session_date === today;
              return (
                <StaggerItem as="li" key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <Link href={`/desafios/${id}/acompanhamentos/${s.id}`} className="group flex min-w-0 flex-1 items-center gap-4">
                    <div className="w-28 shrink-0">
                      <p className="font-medium group-hover:text-brand">{isToday ? "Hoje" : formatDate(s.session_date)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{formatDate(s.session_date, isToday ? "dd/MM · EEEE" : "EEEE")}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="h-2 overflow-hidden rounded-full bg-surface">
                        <div className="h-full origin-left animate-grow-x rounded-full bg-brand" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {done} de {totalTeams} equipes avaliadas{draft ? ` · ${draft} em andamento` : ""}
                      </p>
                    </div>
                    {done === totalTeams && totalTeams > 0 ? (
                      <StatusBadge tone="success" className="max-sm:hidden">Completo</StatusBadge>
                    ) : done + draft === 0 ? (
                      <StatusBadge className="max-sm:hidden">Nada registrado</StatusBadge>
                    ) : null}
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground max-sm:hidden" />
                  </Link>
                  <div className="flex gap-2 max-sm:hidden sm:shrink-0">
                    <DownloadButton
                      href={`/api/relatorios/diario?desafio=${id}&data=${s.session_date}`}
                      label="Baixar planilha"
                      variant="outline"
                      size="sm"
                    />
                  </div>
                </StaggerItem>
              );
            })}
          </ul>
        )}
        {!todos && visible.length < listed.length && (
          <Link href={`/desafios/${id}?todos=1`} className="mt-3 inline-block text-sm font-medium text-brand hover:underline">
            Ver todos os {listed.length} dias
          </Link>
        )}
      </StaggerItem>
    </Stagger>
  );
}
