"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { NativeSelect } from "@/components/shared/native-select";
import { toastResult } from "@/components/shared/toast-result";
import { createTeam, updateTeam } from "@/lib/actions/teams";
import { teamSchema, type TeamInput } from "@/lib/validation";

export function TeamDialog({
  challengeId,
  team,
  monitors,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  challengeId: string;
  team?: { id: string; name: string; project_title: string; description: string; assigned_monitor_id: string | null };
  monitors: { id: string; name: string }[];
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setInnerOpen(o));
  const [pending, startTransition] = useTransition();
  const form = useForm<TeamInput>({
    resolver: zodResolver(teamSchema) as never,
    defaultValues: {
      name: team?.name ?? "",
      project_title: team?.project_title ?? "",
      description: team?.description ?? "",
      assigned_monitor_id: team?.assigned_monitor_id ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = team ? await updateTeam(challengeId, team.id, values) : await createTeam(challengeId, values);
      if (toastResult(r)) {
        setOpen(false);
        if (!team) form.reset();
      }
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "Editar equipe" : "Nova equipe"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Nome da equipe" htmlFor="team-name" required error={form.formState.errors.name?.message}>
            <Input id="team-name" placeholder="Ex.: Equipe 01" {...form.register("name")} />
          </Field>
          <Field label="Título do projeto" htmlFor="team-project">
            <Input id="team-project" {...form.register("project_title")} />
          </Field>
          <Field label="Monitor responsável" htmlFor="team-monitor">
            <NativeSelect id="team-monitor" {...form.register("assigned_monitor_id")}>
              <option value="">Sem monitor</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Descrição" htmlFor="team-desc">
            <Textarea id="team-desc" rows={3} {...form.register("description")} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            {team ? "Salvar" : "Cadastrar equipe"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
