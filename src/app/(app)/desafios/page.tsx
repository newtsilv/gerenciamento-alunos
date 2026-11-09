import { Stagger, StaggerItem } from "@/components/shared/motion";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, TrophyIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { NewChallengeDialog } from "@/components/challenges/new-challenge-dialog";
import { requireViewer } from "@/lib/auth";
import { listChallenges } from "@/lib/data/challenges";
import { CHALLENGE_STATUS, CHALLENGE_STATUS_TONE, WEEKDAYS } from "@/lib/domain/constants";

export const metadata: Metadata = { title: "Desafios" };

export default async function ChallengesPage() {
  const viewer = await requireViewer();
  const challenges = await listChallenges();

  return (
    <PageContainer>
      <PageHeader
        title="Desafios"
        description="Escolha um desafio para registrar o acompanhamento."
        actions={viewer.isAdmin ? <NewChallengeDialog /> : undefined}
      />
      {challenges.length === 0 ? (
        <EmptyState
          icon={TrophyIcon}
          title="Nenhum desafio disponível"
          description={
            viewer.isAdmin
              ? "Crie o primeiro desafio para cadastrar equipes e iniciar os acompanhamentos."
              : "Você ainda não foi vinculado a nenhum desafio. Procure a supervisão."
          }
          action={viewer.isAdmin ? <NewChallengeDialog /> : undefined}
        />
      ) : (
        <Stagger className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {challenges.map((c) => {
            const days = c.monitoring_weekdays.map((d) => `${WEEKDAYS[d].toLowerCase()}s`).join(" e ");
            const teams = c.teams[0]?.count ?? 0;
            return (
              <StaggerItem key={c.id} className="min-w-0">
              <Link
                href={`/desafios/${c.id}`}
                className="group flex h-full min-w-0 items-center gap-3 rounded-2xl border bg-card p-4 sm:gap-4 sm:p-5 transition-all duration-300 hover:border-brand/30 hover:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.15)]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand sm:size-12 sm:rounded-2xl">
                  <TrophyIcon className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-foreground transition-colors group-hover:text-brand">{c.name}</h2>
                    {c.status !== "ativo" && <StatusBadge tone={CHALLENGE_STATUS_TONE[c.status]}>{CHALLENGE_STATUS[c.status]}</StatusBadge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground sm:truncate">
                    {[c.company, `${teams} ${teams === 1 ? "equipe" : "equipes"}`, `acompanhamento às ${days}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </PageContainer>
  );
}
