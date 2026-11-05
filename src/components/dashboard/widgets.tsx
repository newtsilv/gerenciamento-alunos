import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { FOLLOWUP_STATUS, FOLLOWUP_TONE } from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/dates";
import { formatAverage } from "@/lib/domain/scores";
import type { DashboardData } from "@/lib/data/dashboard";

export function Panel({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="min-w-0 animate-fade-up rounded-2xl border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Distribuição da última situação registrada de cada aluno (barra segmentada + rótulos). */
export function SituationBar({ data }: { data: DashboardData }) {
  const s = data.situation;
  const items = [
    { key: "evoluindo_bem", label: FOLLOWUP_STATUS.evoluindo_bem, value: s.evoluindo_bem, color: "var(--success)" },
    { key: "precisa_atencao", label: FOLLOWUP_STATUS.precisa_atencao, value: s.precisa_atencao, color: "var(--warning)" },
    { key: "necessita_intervencao", label: FOLLOWUP_STATUS.necessita_intervencao, value: s.necessita_intervencao, color: "var(--danger)" },
    { key: "sem_situacao", label: "Avaliado, sem situação", value: s.sem_situacao, color: "var(--muted-foreground)" },
    { key: "nao_avaliado", label: "Sem avaliação no período", value: data.notEvaluatedStudents, color: "var(--border)" },
  ];
  const total = items.reduce((n, i) => n + i.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-muted-foreground">Sem alunos no período.</p>;
  return (
    <div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Distribuição das situações dos alunos">
        {items
          .filter((i) => i.value)
          .map((i) => (
            <div key={i.key} title={`${i.label}: ${i.value}`} className="h-full origin-left animate-grow-x" style={{ width: `${(i.value / total) * 100}%`, background: i.color }} />
          ))}
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
              {i.label}
            </span>
            <span className="font-medium tabular-nums">
              {i.value} <span className="text-xs font-normal text-muted-foreground">({Math.round((i.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Alunos sem avaliação não são contados como desempenho baixo.</p>
    </div>
  );
}

export function AttentionList({ data, showChallenge }: { data: DashboardData; showChallenge?: boolean }) {
  if (!data.attention.length) {
    return (
      <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <CheckCircle2Icon className="size-4 text-success" /> Nenhuma equipe sinalizada no período.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {data.attention.slice(0, 12).map((t) => (
        <li key={t.teamId}>
          <Link href={`/desafios/${t.challengeId}/equipes/${t.teamId}`} className="flex flex-col gap-1.5 py-3 transition-colors hover:text-brand">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                <AlertTriangleIcon className="size-4 text-warning" />
                {t.teamName}
                {showChallenge && <span className="text-xs font-normal text-muted-foreground">· {t.challengeName}</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDate(t.lastDate)} · média {formatAverage(t.average)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {t.previousUnresolved && <StatusBadge tone="danger">Dificuldades anteriores não resolvidas</StatusBadge>}
              {t.flagged.map((f, i) => (
                <StatusBadge key={i} tone={FOLLOWUP_TONE[f.status]}>
                  {f.name} · {FOLLOWUP_STATUS[f.status]}
                </StatusBadge>
              ))}
            </div>
            {t.difficulties && <p className="line-clamp-2 text-sm text-muted-foreground">{t.difficulties}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
