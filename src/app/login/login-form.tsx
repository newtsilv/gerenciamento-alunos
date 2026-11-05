"use client";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { signIn } from "@/lib/actions/auth";

const schema = z.object({
  login: z.string().trim().min(1, "Informe seu RA"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export function LoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { login: "", password: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await signIn({ ...values, next });
      if (result && !result.ok) setError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
      <Field label="RA" htmlFor="login" error={form.formState.errors.login?.message} hint="Registro acadêmico (administradores também podem usar o e-mail).">
        <Input id="login" autoComplete="username" autoCapitalize="none" inputMode="text" className="h-11" {...form.register("login")} aria-invalid={!!form.formState.errors.login} />
      </Field>
      <Field label="Senha" htmlFor="password" error={form.formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" className="h-11" {...form.register("password")} aria-invalid={!!form.formState.errors.password} />
      </Field>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending && <Loader2Icon className="animate-spin" />}
        Entrar
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        As contas são criadas por um administrador do sistema.
      </p>
    </form>
  );
}
