import type { Metadata } from "next";
import { Logo } from "@/components/layout/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm animate-fade-up">
          <Logo href="/login" />
          <h1 className="mt-10 text-[1.75rem] font-semibold">Bem-vindo de volta</h1>
          <p className="mt-1 text-muted-foreground">Entre para registrar e consultar os acompanhamentos.</p>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-navy lg:block">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand/60 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="text-3xl leading-snug font-semibold">
            Acompanhe equipes, avalie alunos e gere relatórios em minutos.
          </p>
          <p className="mt-3 max-w-md text-white/70">
            Avaliações coletivas e individuais na mesma tela, histórico preservado e planilhas prontas para a coordenação.
          </p>
        </div>
      </div>
    </div>
  );
}
