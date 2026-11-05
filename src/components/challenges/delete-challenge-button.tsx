"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toastResult } from "@/components/shared/toast-result";
import { deleteChallenge } from "@/lib/actions/challenges";

export function DeleteChallengeButton({ challengeId, name }: { challengeId: string; name: string }) {
  return (
    <ConfirmDialog
      title={`Excluir "${name}"?`}
      description="Todas as equipes, vínculos, avaliações e entregas deste desafio serão excluídos permanentemente, assim como os alunos que só participavam dele. Para preservar o histórico, prefira alterar o status para Arquivado."
      confirmLabel="Excluir definitivamente"
      destructive
      onConfirm={async () => {
        const r = await deleteChallenge(challengeId);
        if (r && !r.ok) return toastResult(r);
      }}
      trigger={
        <Button variant="destructive">
          <Trash2Icon />
          Excluir desafio
        </Button>
      }
    />
  );
}
