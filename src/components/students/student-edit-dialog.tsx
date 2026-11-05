"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { toastResult } from "@/components/shared/toast-result";
import { updateStudent } from "@/lib/actions/teams";
import { studentSchema, type StudentInput } from "@/lib/validation";

export function StudentEditDialog({ student }: { student: { id: string; full_name: string; registration: string | null; email: string | null; notes: string } }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: { full_name: student.full_name, registration: student.registration ?? "", email: student.email ?? "", notes: student.notes },
  });
  const e = form.formState.errors;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <PencilIcon /> Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar aluno</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            startTransition(async () => {
              if (toastResult(await updateStudent(student.id, v))) setOpen(false);
            }),
          )}
        >
          <Field label="Nome completo" required error={e.full_name?.message}>
            <Input {...form.register("full_name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matrícula / RA">
              <Input {...form.register("registration")} />
            </Field>
            <Field label="E-mail" error={e.email?.message}>
              <Input type="email" {...form.register("email")} />
            </Field>
          </div>
          <Field label="Observações cadastrais">
            <Textarea rows={2} {...form.register("notes")} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Salvar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
