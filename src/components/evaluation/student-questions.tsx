"use client";

import { Textarea } from "@/components/ui/textarea";
import { STUDENT_QUESTIONS, type StudentState } from "./evaluation-state";

/** As perguntas do Squad Sync, respondidas por cada aluno. */
export function StudentQuestions({
  s,
  disabled,
  onChange,
  prevDifficulty,
  rows = 2,
}: {
  s: StudentState;
  disabled?: boolean;
  onChange: (p: Partial<StudentState>) => void;
  prevDifficulty?: string;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      {prevDifficulty && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">Dificuldade anterior: {prevDifficulty}</p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {STUDENT_QUESTIONS.map(([key, label, hint]) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{label}</span>
            <Textarea
              rows={rows}
              placeholder={hint}
              value={s[key]}
              disabled={disabled}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<StudentState>)}
            />
          </label>
        ))}
      </div>
      {/* registros feitos antes das perguntas continuam visíveis */}
      {(s.notes || s.guidance) && (
        <div className="rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground">
          {s.notes && <p>Observação: {s.notes}</p>}
          {s.guidance && <p>Orientação: {s.guidance}</p>}
        </div>
      )}
    </div>
  );
}
