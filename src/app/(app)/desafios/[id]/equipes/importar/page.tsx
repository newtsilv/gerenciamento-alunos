import { Reveal } from "@/components/shared/motion";
import { notFound } from "next/navigation";
import { ImportWizard } from "@/components/import/import-wizard";
import { requireChallengeAccess } from "@/lib/auth";
import { getChallenge, listTeams } from "@/lib/data/challenges";

export default async function ImportPage({ params }: PageProps<"/desafios/[id]/equipes/importar">) {
  const { id } = await params;
  const access = await requireChallengeAccess(id);
  if (!access.canManage) notFound();
  const [teams, challenge] = await Promise.all([listTeams(id, { includeInactive: true }), getChallenge(id)]);
  if (!challenge) notFound();
  return (
    <Reveal>
      <ImportWizard challengeId={id} existingTeams={teams.map((t) => t.name)} challengeStartDate={challenge.start_date} />
    </Reveal>
  );
}
