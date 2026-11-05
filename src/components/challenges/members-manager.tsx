"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/shared/native-select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toastResult } from "@/components/shared/toast-result";
import { addChallengeMember, removeChallengeMember } from "@/lib/actions/challenges";
import { CHALLENGE_ROLE, type ChallengeRole } from "@/lib/domain/constants";

type Member = { memberId: string; id: string; name: string; email: string; role: ChallengeRole };
type Person = { id: string; name: string; email: string };

export function MembersManager({ challengeId, members, people }: { challengeId: string; members: Member[]; people: Person[] }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ChallengeRole>("monitor");
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      if (!userId) return;
      const r = await addChallengeMember({ challenge_id: challengeId, user_id: userId, role });
      if (toastResult(r)) setUserId("");
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
        <NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Pessoa">
          <option value="">Selecione uma pessoa…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as ChallengeRole)} aria-label="Papel">
          {Object.entries(CHALLENGE_ROLE).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
        <Button onClick={add} disabled={!userId || pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          Vincular
        </Button>
      </div>

      {(Object.keys(CHALLENGE_ROLE) as ChallengeRole[]).map((r) => {
        const list = members.filter((m) => m.role === r);
        return (
          <div key={r}>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              {CHALLENGE_ROLE[r]}
              · {list.length}
            </h3>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Nenhum vínculo.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {list.map((m) => (
                  <li key={m.memberId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <ConfirmDialog
                      title="Remover vínculo?"
                      description={`${m.name} deixará de ter acesso como ${CHALLENGE_ROLE[m.role].toLowerCase()} neste desafio. Avaliações já registradas são mantidas.`}
                      confirmLabel="Remover"
                      destructive
                      onConfirm={async () => toastResult(await removeChallengeMember(challengeId, m.memberId))}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Remover ${m.name}`}>
                          <Trash2Icon />
                        </Button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
