"use client";

import { useState, useTransition, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { toastResult } from "@/components/shared/toast-result";
import { addStudentToTeam } from "@/lib/actions/teams";
import { todayISO } from "@/lib/domain/dates";
import { studentSchema, type StudentInput } from "@/lib/validation";

export function AddStudentDialog({
  challengeId,
  teamId,
  teamName,
  trigger,
  defaultStartDate,
}: {
  challengeId: string;
  teamId: string;
  teamName: string;
  trigger: ReactElement;
  defaultStartDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => (defaultStartDate < todayISO() ? defaultStartDate : todayISO()));
  const [pending, startTransition] = useTransition();
  const form = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: { full_name: "", registration: "", email: "" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await addStudentToTeam(challengeId, teamId, { ...values, start_date: startDate });
      if (toastResult(r)) {
        form.reset();
        setOpen(false);
      }
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar aluno</DialogTitle>
          <DialogDescription>
            {teamName}. Se a matrícula já existir, o aluno cadastrado é reaproveitado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Nome completo" htmlFor="st-name" required error={errors.full_name?.message}>
            <Input id="st-name" {...form.register("full_name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matrícula" htmlFor="st-reg" hint="Identificador estável do aluno">
              <Input id="st-reg" {...form.register("registration")} />
            </Field>
            <Field label="Está na equipe desde" htmlFor="st-start" hint="Início do desafio, ou a data em que entrou">
              <Input id="st-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
          </div>
          <Field label="E-mail" htmlFor="st-email" error={errors.email?.message}>
            <Input id="st-email" type="email" {...form.register("email")} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
