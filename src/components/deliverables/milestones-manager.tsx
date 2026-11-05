"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toastResult } from "@/components/shared/toast-result";
import { addDefaultMilestones, createMilestone, deleteMilestone, updateMilestone } from "@/lib/actions/deliverables";
import { formatDate } from "@/lib/domain/dates";

type Milestone = { id: string; title: string; description: string; due_date: string | null };

export function MilestonesManager({ challengeId, milestones }: { challengeId: string; milestones: Milestone[] }) {
  const [editing, setEditing] = useState<Milestone | "new" | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon /> Novo marco
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => void toastResult(await addDefaultMilestones(challengeId)))}>
          <SparklesIcon /> Adicionar marcos sugeridos
        </Button>
      </div>
      {milestones.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhum marco. Cada marco gera automaticamente uma entrega para todas as equipes.
        </p>
      ) : (
        <ol className="divide-y rounded-xl border">
          {milestones.map((m, i) => (
            <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}.</span>
                  {m.title}
                </p>
                <p className="text-xs text-muted-foreground">{m.due_date ? `Prazo ${formatDate(m.due_date)}` : "Sem prazo"}</p>
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon-sm" aria-label={`Editar ${m.title}`} onClick={() => setEditing(m)}>
                  <PencilIcon />
                </Button>
                <ConfirmDialog
                  title={`Excluir marco "${m.title}"?`}
                  description="As entregas correspondentes de todas as equipes também serão excluídas."
                  destructive
                  confirmLabel="Excluir"
                  onConfirm={async () => toastResult(await deleteMilestone(challengeId, m.id))}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${m.title}`}>
                      <Trash2Icon />
                    </Button>
                  }
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <MilestoneDialog key={editing === "new" ? "new" : editing.id} challengeId={challengeId} milestone={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function MilestoneDialog({ challengeId, milestone, onClose }: { challengeId: string; milestone: Milestone | null; onClose: () => void }) {
  const [v, setV] = useState({ title: milestone?.title ?? "", description: milestone?.description ?? "", due_date: milestone?.due_date ?? "" });
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{milestone ? "Editar marco" : "Novo marco"}</DialogTitle>
          <DialogDescription>Alterações são aplicadas às entregas de todas as equipes.</DialogDescription>
        </DialogHeader>
        <Field label="Título" required>
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <Textarea rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
        <Field label="Prazo">
          <Input type="date" value={v.due_date} onChange={(e) => setV({ ...v, due_date: e.target.value })} />
        </Field>
        <Button
          disabled={pending || !v.title.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = milestone ? await updateMilestone(challengeId, milestone.id, v) : await createMilestone(challengeId, v);
              if (toastResult(r)) onClose();
            })
          }
        >
          {pending && <Loader2Icon className="animate-spin" />}
          Salvar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
