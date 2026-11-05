"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { NativeSelect } from "@/components/shared/native-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toastResult } from "@/components/shared/toast-result";
import { deleteDeliverable, saveDeliverable, setDeliverableStatus } from "@/lib/actions/deliverables";
import { DELIVERABLE_STATUS, DELIVERABLE_TONE, type DeliverableStatus } from "@/lib/domain/constants";
import { formatDate, todayISO } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

type Deliverable = {
  id: string;
  milestone_id: string | null;
  title: string;
  description: string;
  due_date: string | null;
  status: DeliverableStatus;
  completed_at: string | null;
  notes: string;
};

export function DeliverablesEditor({
  challengeId,
  teamId,
  deliverables,
  canManage,
  canUpdate,
}: {
  challengeId: string;
  teamId: string;
  deliverables: Deliverable[];
  canManage: boolean;
  canUpdate: boolean;
}) {
  const [editing, setEditing] = useState<Deliverable | "new" | null>(null);
  const [, startTransition] = useTransition();
  const today = todayISO();
  const done = deliverables.filter((d) => d.status === "concluida").length;
  const pct = deliverables.length ? Math.round((done / deliverables.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
          <div className="h-full origin-left animate-grow-x rounded-full bg-success" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {done}/{deliverables.length} · {pct}%
        </span>
      </div>
      {deliverables.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Nenhuma entrega. Cadastre marcos do desafio na aba Entregas.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {deliverables.map((d) => {
            const late = d.status !== "concluida" && d.due_date && d.due_date < today;
            return (
              <li key={d.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className={cn("text-xs text-muted-foreground", late && "text-danger")}>
                    {d.due_date ? `Prazo ${formatDate(d.due_date)}` : "Sem prazo"}
                    {late && " · atrasada"}
                    {d.completed_at && ` · concluída em ${formatDate(d.completed_at)}`}
                  </p>
                  {d.notes && <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  {canUpdate ? (
                    <NativeSelect
                      className="h-8 w-40"
                      defaultValue={d.status}
                      aria-label={`Status de ${d.title}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        startTransition(async () => void toastResult(await setDeliverableStatus(challengeId, d.id, v)));
                      }}
                    >
                      {Object.entries(DELIVERABLE_STATUS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <StatusBadge tone={DELIVERABLE_TONE[d.status]}>{DELIVERABLE_STATUS[d.status]}</StatusBadge>
                  )}
                  {canUpdate && (
                    <Button variant="ghost" size="icon-sm" aria-label="Editar entrega" onClick={() => setEditing(d)}>
                      <PencilIcon />
                    </Button>
                  )}
                  {canManage && !d.milestone_id && (
                    <ConfirmDialog
                      title="Excluir entrega?"
                      destructive
                      confirmLabel="Excluir"
                      onConfirm={async () => toastResult(await deleteDeliverable(challengeId, d.id))}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label="Excluir entrega">
                          <Trash2Icon />
                        </Button>
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canManage && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing("new")}>
          <PlusIcon /> Entrega específica da equipe
        </Button>
      )}
      {editing && (
        <DeliverableDialog
          key={editing === "new" ? "new" : editing.id}
          challengeId={challengeId}
          teamId={teamId}
          deliverable={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function DeliverableDialog({
  challengeId,
  teamId,
  deliverable,
  onClose,
}: {
  challengeId: string;
  teamId: string;
  deliverable: Deliverable | null;
  onClose: () => void;
}) {
  const [v, setV] = useState({
    title: deliverable?.title ?? "",
    description: deliverable?.description ?? "",
    due_date: deliverable?.due_date ?? "",
    status: deliverable?.status ?? ("nao_iniciada" as DeliverableStatus),
    notes: deliverable?.notes ?? "",
  });
  const [pending, startTransition] = useTransition();
  const fromMilestone = !!deliverable?.milestone_id;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{deliverable ? "Editar entrega" : "Nova entrega"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Título" required hint={fromMilestone ? "Definido pelo marco do desafio." : undefined}>
            <Input value={v.title} disabled={fromMilestone} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Descrição">
            <Textarea rows={2} value={v.description} disabled={fromMilestone} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prazo">
              <Input type="date" value={v.due_date} disabled={fromMilestone} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
            </Field>
            <Field label="Status">
              <NativeSelect value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as DeliverableStatus })}>
                {Object.entries(DELIVERABLE_STATUS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Observações">
            <Textarea rows={2} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
          <Button
            disabled={pending || !v.title.trim()}
            onClick={() =>
              startTransition(async () => {
                if (toastResult(await saveDeliverable(challengeId, teamId, deliverable?.id ?? null, v))) onClose();
              })
            }
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
