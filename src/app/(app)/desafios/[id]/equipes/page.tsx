import { notFound } from "next/navigation";
import { TeamsBoard } from "@/components/teams/teams-board";
import { requireChallengeAccess } from "@/lib/auth";
import { getChallenge, listTeamsWithMembers, membersByRole } from "@/lib/data/challenges";

export default async function TeamsPage({ params }: PageProps<"/desafios/[id]/equipes">) {
  const { id } = await params;
  const access = await requireChallengeAccess(id);
  const [challenge, teams] = await Promise.all([getChallenge(id), listTeamsWithMembers(id)]);
  if (!challenge) notFound();

  return (
    <TeamsBoard
      challengeId={id}
      teams={teams}
      monitors={membersByRole(challenge, "monitor")}
      canManage={access.canManage}
      viewerId={access.viewer.id}
      challengeStartDate={challenge.start_date}
    />
  );
}
