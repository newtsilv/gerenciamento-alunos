import { ChallengeBackLink } from "@/components/challenges/challenge-back-link";
import { notFound } from "next/navigation";
import { PageContainer } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ChallengeTabs } from "@/components/challenges/challenge-tabs";
import { requireChallengeAccess } from "@/lib/auth";
import { getChallenge } from "@/lib/data/challenges";
import { CHALLENGE_STATUS, CHALLENGE_STATUS_TONE } from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/dates";

export default async function ChallengeLayout({ children, params }: LayoutProps<"/desafios/[id]">) {
  const { id } = await params;
  const access = await requireChallengeAccess(id);
  const challenge = await getChallenge(id);
  if (!challenge) notFound();

  return (
    <PageContainer>
      <header className="mb-4 animate-fade-up">
        <ChallengeBackLink challengeId={id} />
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold sm:text-[1.75rem]">{challenge.name}</h1>
          {challenge.status !== "ativo" && <StatusBadge tone={CHALLENGE_STATUS_TONE[challenge.status]}>{CHALLENGE_STATUS[challenge.status]}</StatusBadge>}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[challenge.company, `${formatDate(challenge.start_date)} a ${formatDate(challenge.end_date)}`].filter(Boolean).join(" · ")}
        </p>
      </header>
      <ChallengeTabs challengeId={id} canManage={access.canManage} />
      {children}
    </PageContainer>
  );
}
