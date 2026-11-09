"use client";

import { Textarea } from "@/components/ui/textarea";
import { SCORE_VALUES } from "@/lib/domain/constants";
import type { StudentState } from "./evaluation-state";
import type { Score } from "./score-input";

export function StudentNotes({
  s,
  disabled,
  onChange,
  prevDifficulty,
  onFillRow,
}: {
  s: StudentState;
  disabled?: boolean;
  onChange: (p: Partial<StudentState>) => void;
  prevDifficulty?: string;
  onFillRow?: (v: Score) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {prevDifficulty && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">Dificuldade anterior: {prevDifficulty}</p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Observação individual
          <Textarea rows={2} value={s.notes} disabled={disabled} onChange={(e) => onChange({ notes: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Dificuldade identificada
          <Textarea rows={2} value={s.difficulty} disabled={disabled} onChange={(e) => onChange({ difficulty: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Orientação recomendada
          <Textarea rows={2} value={s.guidance} disabled={disabled} onChange={(e) => onChange({ guidance: e.target.value })} />
        </label>
      </div>
      {onFillRow && !s.absent && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          Aplicar a todos os critérios deste aluno:
          {SCORE_VALUES.map((n) => (
            <button key={n} type="button" disabled={disabled} onClick={() => onFillRow(n)} className="size-7 rounded-md border bg-card hover:bg-brand-soft">
              {n}
            </button>
          ))}
          <button type="button" disabled={disabled} onClick={() => onFillRow(null)} className="h-7 rounded-md border bg-card px-2 hover:bg-surface">
            N/O
          </button>
        </div>
      )}
    </div>
  );
}
