import { Stagger, StaggerItem } from "@/components/shared/motion";
import type { Metadata } from "next";
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarIcon,
  GraduationCapIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DashboardFilters } from "@/components/dashboard/filters";
import { AttentionList, Panel, SituationBar } from "@/components/dashboard/widgets";
import { DeliverablesChart, EvolutionChart } from "@/components/dashboard/charts";
import { requireViewer } from "@/lib/auth";
import { loadDashboard } from "@/lib/data/dashboard";
import { isISODate } from "@/lib/domain/dates";
import type { FollowupStatus } from "@/lib/domain/constants";

export const metadata: Metadata = { title: "Dashboard" };

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const challengeId = str(sp.desafio);
  const data = await loadDashboard({
    challengeId,
    monitorId: str(sp.monitor),
    from: isISODate(sp.de) ? sp.de : undefined,
    to: isISODate(sp.ate) ? sp.ate : undefined,
    situation: str(sp.situacao) as FollowupStatus | undefined,
  });
  const pct = data.expected ? Math.round((data.done / data.expected) * 100) : 0;

  return (
    <PageContainer>
      <PageHeader title={`Olá, ${viewer.fullName.split(" ")[0]}`} description="Visão geral dos acompanhamentos." />
      <Stagger>
      <StaggerItem>
        <DashboardFilters challenges={data.challenges.map((c) => ({ id: c.id, name: c.name }))} />
      </StaggerItem>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {/* no celular ficam só os dois números que pedem ação: realizados e pendentes */}
        <StatCard label="Desafios ativos" value={data.activeChallenges} icon={TrophyIcon} className="max-sm:hidden" />
        <StatCard label="Equipes" value={data.teamCount} icon={UsersIcon} className="max-sm:hidden" />
        <StatCard label="Alunos" value={data.studentCount} icon={GraduationCapIcon} className="max-sm:hidden" />
        <StatCard label="Previstos" value={data.expected} hint="Sessões até hoje × equipes" icon={CalendarIcon} className="max-sm:hidden" />
        <StatCard label="Realizados" value={data.done} hint={`${pct}% dos acompanhamentos previstos`} icon={CalendarCheckIcon} tone="success" />
        <StatCard
          label="Pendentes"
          value={data.pending}
          hint={data.drafts ? `${data.drafts} em andamento` : undefined}
          icon={CalendarClockIcon}
          tone={data.pending ? "warning" : "success"}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Evolução das médias" description="Média das notas por dia de acompanhamento (Não observado fica fora da média).">
          <EvolutionChart data={data.evolution} />
        </Panel>
        <Panel title="Situação dos alunos" description="Última situação registrada no período.">
          <SituationBar data={data} />
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Equipes que precisam de atenção" description="Com base no último acompanhamento de cada equipe.">
          <AttentionList data={data} showChallenge={!challengeId} />
        </Panel>
        <Panel title="Progresso das entregas" description={data.overdue ? `${data.overdue} entrega(s) com prazo vencido.` : "Status das entregas por equipe."}>
          <DeliverablesChart data={data.deliverableProgress} />
        </Panel>
      </div>
      </Stagger>
    </PageContainer>
  );
}
