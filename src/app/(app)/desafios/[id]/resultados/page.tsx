import { Stagger, StaggerItem } from "@/components/shared/motion";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangleIcon, CalendarCheckIcon, CalendarClockIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { DashboardFilters } from "@/components/dashboard/filters";
import { AttentionList, Panel, SituationBar } from "@/components/dashboard/widgets";
import { EvolutionChart } from "@/components/dashboard/charts";
import { requireChallengeAccess } from "@/lib/auth";
import { getChallenge, listTeams, membersByRole } from "@/lib/data/challenges";
import { loadDashboard } from "@/lib/data/dashboard";
import { formatDate, isISODate } from "@/lib/domain/dates";
import type { FollowupStatus } from "@/lib/domain/constants";

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function ChallengeOverview({ params, searchParams }: PageProps<"/desafios/[id]/resultados">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireChallengeAccess(id);
  const [challenge, teams] = await Promise.all([getChallenge(id), listTeams(id)]);
  if (!challenge) notFound();

  const data = await loadDashboard({
    challengeId: id,
    teamId: str(sp.equipe),
    monitorId: str(sp.monitor),
    from: isISODate(sp.de) ? sp.de : undefined,
    to: isISODate(sp.ate) ? sp.ate : undefined,
    situation: str(sp.situacao) as FollowupStatus | undefined,
  });

    const monitors = membersByRole(challenge, "monitor");
  const pct = data.expected ? Math.round((data.done / data.expected) * 100) : 0;

  return (
    <Stagger className="flex flex-col gap-6">
      <StaggerItem>
        <DashboardFilters
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          monitors={monitors.map((m) => ({ id: m.id, name: m.name }))}
        />
      </StaggerItem>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Equipes" value={data.teamCount} icon={UsersIcon} hint={`${data.studentCount} alunos`} />
        <StatCard label="Avaliações feitas" value={data.done} tone="success" icon={CalendarCheckIcon} hint={`${pct}% de ${data.expected} previstas`} />
        <StatCard
          label="Pendentes"
          value={data.pending}
          tone={data.pending ? "warning" : "success"}
          icon={CalendarClockIcon}
          hint={data.lastSession ? `${data.lastSession.pending} no último dia (${formatDate(data.lastSession.session_date, "dd/MM")})` : undefined}
        />
        <StatCard label="Equipes em atenção" value={data.attention.length} tone={data.attention.length ? "warning" : "success"} icon={AlertTriangleIcon} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Evolução dos acompanhamentos"
          action={
            <Button variant="outline" size="sm" render={<Link href={`/desafios/${id}/historico`} />}>
              Ver histórico
            </Button>
          }
        >
          <EvolutionChart data={data.evolution} />
        </Panel>
        <Panel title="Situação dos alunos">
          <SituationBar data={data} />
        </Panel>
      </div>
      <Panel title="Equipes com dificuldades">
        <AttentionList data={data} />
      </Panel>
    </Stagger>
  );
}
