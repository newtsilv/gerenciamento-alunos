"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeftIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { NativeSelect } from "@/components/shared/native-select";
import { toastResult } from "@/components/shared/toast-result";
import { transferStudent } from "@/lib/actions/teams";
import { todayISO } from "@/lib/domain/dates";

export type TransferTarget = { studentId: string; studentName: string; fromTeamId: string; fromTeamName: string };

export function TransferDialog({
  challengeId,
  target,
  teams,
  onClose,
}: {
  challengeId: string;
  target: TransferTarget | null;
  teams: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [toTeam, setToTeam] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      if (!target || !toTeam) return;
      const r = await transferStudent(challengeId, { student_id: target.studentId, to_team_id: toTeam, date, reason });
      if (toastResult(r)) {
        setToTeam("");
        setReason("");
        onClose();
      }
    });

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir aluno</DialogTitle>
          <DialogDescription>
            {target?.studentName} sairá de <strong>{target?.fromTeamName}</strong>. O vínculo anterior é encerrado e as avaliações
            anteriores permanecem associadas à equipe de origem.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Equipe de destino" htmlFor="tr-team" required>
            <NativeSelect id="tr-team" value={toTeam} onChange={(e) => setToTeam(e.target.value)}>
              <option value="">Selecione…</option>
              {teams
                .filter((t) => t.id !== target?.fromTeamId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="Data da transferência" htmlFor="tr-date" required>
            <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Motivo" htmlFor="tr-reason">
            <Textarea id="tr-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button onClick={submit} disabled={!toTeam || !date || pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <ArrowRightLeftIcon />}
            Confirmar transferência
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
