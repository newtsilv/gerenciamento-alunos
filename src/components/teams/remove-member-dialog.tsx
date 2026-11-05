"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { toastResult } from "@/components/shared/toast-result";
import { removeStudentFromTeam } from "@/lib/actions/teams";
import { todayISO } from "@/lib/domain/dates";

export type RemoveTarget = { membershipId: string; studentName: string; teamName: string };

export function RemoveMemberDialog({ challengeId, target, onClose }: { challengeId: string; target: RemoveTarget | null; onClose: () => void }) {
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover da equipe</DialogTitle>
          <DialogDescription>
            {target?.studentName} deixará a {target?.teamName}. O histórico e as avaliações são mantidos.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Data de saída" htmlFor="rm-date">
            <Input id="rm-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Motivo" htmlFor="rm-reason">
            <Input id="rm-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: desistência" />
          </Field>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                if (!target) return;
                const r = await removeStudentFromTeam(challengeId, target.membershipId, date, reason);
                if (toastResult(r)) onClose();
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Remover da equipe
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
