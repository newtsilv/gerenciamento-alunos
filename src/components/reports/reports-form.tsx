"use client";

import { useMemo, useState } from "react";
import { CalendarDaysIcon, CalendarRangeIcon, UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared/field";
import { NativeSelect } from "@/components/shared/native-select";
import { formatDate, weekRange } from "@/lib/domain/dates";
import { DownloadButton } from "./download-button";

type Challenge = { id: string; name: string; sessions: { date: string; done: number }[] };

export function ReportsForm({ challenges, today }: { challenges: Challenge[]; today: string }) {
  const [challengeId, setChallengeId] = useState(challenges[0]?.id ?? "");
  const challenge = challenges.find((c) => c.id === challengeId);
  const pastSessions = useMemo(() => (challenge?.sessions ?? []).filter((s) => s.date <= today).reverse(), [challenge, today]);
  const [date, setDate] = useState(pastSessions[0]?.date ?? today);
  const [week, setWeek] = useState(today);
  const range = weekRange(week || today);
  const weekSessions = (challenge?.sessions ?? []).filter((s) => s.date >= range.start && s.date <= range.end);

  const card = "flex flex-col gap-4 rounded-2xl border bg-card p-5 animate-fade-up";
  return (
    <div className="flex flex-col gap-6">
      <Field label="Desafio" className="max-w-md">
        <NativeSelect value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
          {challenges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className={card}>
          <Header icon={CalendarDaysIcon} title="Relatório diário" description="Resumo, avaliações individuais, avaliações das equipes e pendências de um dia." />
          <Field label="Data do acompanhamento">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {pastSessions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pastSessions.slice(0, 6).map((s) => (
                <button
                  key={s.date}
                  type="button"
                  onClick={() => setDate(s.date)}
                  className={`h-8 rounded-lg border px-2.5 text-xs ${s.date === date ? "border-brand bg-brand-soft text-brand" : "hover:bg-surface"}`}
                >
                  {formatDate(s.date, "dd/MM")} · {s.done} aval.
                </button>
              ))}
            </div>
          )}
          <div className="mt-auto">
            <DownloadButton href={`/api/relatorios/diario?desafio=${challengeId}&data=${date}`} label="Baixar Excel diário" disabled={!challengeId || !date} />
          </div>
        </section>

        <section className={card}>
          <Header icon={CalendarRangeIcon} title="Relatório semanal" description="Consolida os acompanhamentos da semana: comparações, evolução, dificuldades recorrentes e pendências." />
          <Field label="Qualquer dia da semana" hint={`Semana de ${formatDate(range.start)} a ${formatDate(range.end)} · ${weekSessions.length} sessão(ões)`}>
            <Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
          </Field>
          <div className="mt-auto">
            <DownloadButton href={`/api/relatorios/semanal?desafio=${challengeId}&semana=${week}`} label="Baixar Excel semanal" disabled={!challengeId || !week} />
          </div>
        </section>

        <section className={card}>
          <Header icon={UsersIcon} title="Equipes e integrantes" description="Lista atual de equipes e alunos e o histórico de participação (transferências)." />
          <div className="mt-auto">
            <DownloadButton href={`/api/relatorios/equipes?desafio=${challengeId}`} label="Exportar equipes (.xlsx)" variant="outline" disabled={!challengeId} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Header({ icon: Icon, title, description }: { icon: typeof CalendarDaysIcon; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
