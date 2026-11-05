import { notFound } from "next/navigation";
import { CriteriaManager } from "@/components/criteria/criteria-manager";
import { requireChallengeAccess } from "@/lib/auth";
import { listCriteria } from "@/lib/data/challenges";

export default async function CriteriaPage({ params }: PageProps<"/desafios/[id]/criterios">) {
  const { id } = await params;
  const access = await requireChallengeAccess(id);
  if (!access.canManage) notFound();
  const criteria = await listCriteria(id, { includeInactive: true });
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Notas de 1 a 5, com opção “Não observado” (fora da média). Critérios já utilizados são versionados ao serem editados.
      </p>
      <CriteriaManager challengeId={id} criteria={criteria} />
    </div>
  );
}
