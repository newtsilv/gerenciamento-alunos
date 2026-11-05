"use client";

import { useState, useTransition } from "react";
import { ArrowDownIcon, ArrowUpIcon, EyeOffIcon, Loader2Icon, PencilIcon, PlusIcon, RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { StatusBadge } from "@/components/shared/status-badge";
import { toastResult } from "@/components/shared/toast-result";
import { createCriterion, editCriterion, moveCriterion, setCriterionActive } from "@/lib/actions/criteria";

type Criterion = { id: string; scope: "equipe" | "aluno"; name: string; description: string; position: number; version: number; is_active: boolean };

export function CriteriaManager({ challengeId, criteria }: { challengeId: string; criteria: Criterion[] }) {
  const [editing, setEditing] = useState<Criterion | { scope: "equipe" | "aluno" } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<Parameters<typeof toastResult>[0]>) => startTransition(async () => void toastResult(await fn()));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["equipe", "aluno"] as const).map((scope) => {
        const active = criteria.filter((c) => c.scope === scope && c.is_active).sort((a, b) => a.position - b.position);
        const inactive = criteria.filter((c) => c.scope === scope && !c.is_active);
        return (
          <section key={scope} className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">{scope === "equipe" ? "Critérios coletivos" : "Critérios individuais"}</h2>
              <Button size="sm" onClick={() => setEditing({ scope })}>
                <PlusIcon /> Novo
              </Button>
            </div>
            <ul className="divide-y rounded-xl border">
              {active.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {c.name} {c.version > 1 && <span className="text-xs font-normal text-muted-foreground">v{c.version}</span>}
                    </p>
                    {c.description && <p className="truncate text-xs text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={pending || i === 0} onClick={() => run(() => moveCriterion(challengeId, c.id, -1))}>
                      <ArrowUpIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Descer" disabled={pending || i === active.length - 1} onClick={() => run(() => moveCriterion(challengeId, c.id, 1))}>
                      <ArrowDownIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => setEditing(c)}>
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Desativar" disabled={pending} onClick={() => run(() => setCriterionActive(challengeId, c.id, false))}>
                      <EyeOffIcon />
                    </Button>
                  </div>
                </li>
              ))}
              {!active.length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Nenhum critério ativo.</li>}
            </ul>
            {inactive.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">Versões anteriores e desativados ({inactive.length})</summary>
                <ul className="mt-2 divide-y text-sm">
                  {inactive.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span>
                        {c.name} <StatusBadge className="ml-1">v{c.version}</StatusBadge>
                      </span>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setCriterionActive(challengeId, c.id, true))}>
                        <RotateCcwIcon /> Reativar
                      </Button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}
      {editing && <CriterionDialog key={"id" in editing ? editing.id : editing.scope} challengeId={challengeId} criterion={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CriterionDialog({
  challengeId,
  criterion,
  onClose,
}: {
  challengeId: string;
  criterion: Criterion | { scope: "equipe" | "aluno" };
  onClose: () => void;
}) {
  const existing = "id" in criterion ? criterion : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Editar critério" : "Novo critério"}</DialogTitle>
          {existing && (
            <DialogDescription>Se o critério já foi usado em avaliações, uma nova versão será criada e as avaliações antigas manterão a versão original.</DialogDescription>
          )}
        </DialogHeader>
        <Field label="Nome" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Descrição / orientação ao avaliador">
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = existing
                ? await editCriterion(challengeId, existing.id, name, description)
                : await createCriterion(challengeId, criterion.scope, name, description);
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
