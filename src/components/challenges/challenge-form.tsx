"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { NativeSelect } from "@/components/shared/native-select";
import { toastResult } from "@/components/shared/toast-result";
import { CHALLENGE_STATUS, WEEKDAYS_SHORT } from "@/lib/domain/constants";
import { challengeSchema, type ChallengeInput } from "@/lib/validation";
import { createChallenge, updateChallenge } from "@/lib/actions/challenges";
import { cn } from "@/lib/utils";

export function ChallengeForm({
  challengeId,
  defaultValues,
  onDone,
}: {
  challengeId?: string;
  defaultValues?: Partial<ChallengeInput>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ChallengeInput>({
    resolver: zodResolver(challengeSchema),
    defaultValues: {
      name: "",
      company: "",
      description: "",
      start_date: "",
      end_date: "",
      status: "planejado",
      monitoring_weekdays: [3, 5],
      ...defaultValues,
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      if (challengeId) {
        const result = await updateChallenge(challengeId, values);
        if (toastResult(result)) onDone?.();
      } else {
        const result = await createChallenge(values);
        if (toastResult(result)) {
          onDone?.();
          router.push(`/desafios/${result.data.id}`);
        }
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Field label="Nome do desafio" htmlFor="name" error={errors.name?.message} required className="sm:col-span-2">
        <Input id="name" {...form.register("name")} aria-invalid={!!errors.name} />
      </Field>
      <Field label="Empresa parceira" htmlFor="company" error={errors.company?.message}>
        <Input id="company" {...form.register("company")} />
      </Field>
      <Field label="Status" htmlFor="status">
        <NativeSelect id="status" {...form.register("status")}>
          {Object.entries(CHALLENGE_STATUS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Data de início" htmlFor="start_date" error={errors.start_date?.message} required>
        <Input id="start_date" type="date" {...form.register("start_date")} aria-invalid={!!errors.start_date} />
      </Field>
      <Field label="Data de encerramento" htmlFor="end_date" error={errors.end_date?.message} required>
        <Input id="end_date" type="date" {...form.register("end_date")} aria-invalid={!!errors.end_date} />
      </Field>
      <Field
        label="Dias de acompanhamento"
        error={errors.monitoring_weekdays?.message}
        hint="As sessões de acompanhamento são geradas automaticamente nesses dias."
        className="sm:col-span-2"
      >
        <Controller
          control={form.control}
          name="monitoring_weekdays"
          render={({ field }) => (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS_SHORT.map((label, day) => {
                const selected = field.value.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      field.onChange(
                        selected ? field.value.filter((d) => d !== day) : [...field.value, day].sort(),
                      )
                    }
                    className={cn(
                      "h-9 min-w-12 rounded-lg border px-3 text-sm transition-colors",
                      selected ? "border-brand bg-brand-soft font-medium text-brand" : "hover:bg-surface",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        />
      </Field>
      <Field label="Descrição" htmlFor="description" className="sm:col-span-2">
        <Textarea id="description" rows={3} {...form.register("description")} />
      </Field>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {challengeId ? "Salvar alterações" : "Criar desafio"}
        </Button>
      </div>
    </form>
  );
}
