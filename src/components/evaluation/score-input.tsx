"use client";

import { cn } from "@/lib/utils";
import { SCORE_VALUES } from "@/lib/domain/constants";

/** undefined = não preenchido · null = Não observado · 0..10 = nota */
export type Score = number | null | undefined;

type ScoreTone = "danger" | "warning" | "brand" | "success";

function scoreTone(n: number): ScoreTone {
  return n < 5 ? "danger" : n < 7 ? "warning" : n < 9 ? "brand" : "success";
}

const toneSelected: Record<ScoreTone, string> = {
  danger: "border-danger bg-danger text-white",
  warning: "border-warning bg-warning text-white",
  brand: "border-brand bg-brand text-white",
  success: "border-success bg-success text-white",
};

const toneSoft: Record<ScoreTone, string> = {
  danger: "border-danger/40 bg-danger-soft text-danger",
  warning: "border-warning/40 bg-warning-soft text-warning",
  brand: "border-brand/30 bg-brand-soft text-brand",
  success: "border-success/30 bg-success-soft text-success",
};

export function ScoreSegment({
  value,
  onChange,
  disabled,
  label,
  fluid,
}: {
  value: Score;
  onChange: (v: Score) => void;
  disabled?: boolean;
  label: string;
  /** ocupa toda a largura, com alvos de toque maiores (celular) */
  fluid?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={fluid ? "grid grid-cols-6 gap-1.5" : "flex flex-wrap gap-1"}>
      {SCORE_VALUES.map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(selected ? undefined : n)}
            className={cn(
              "rounded-lg border text-sm font-medium tabular-nums transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
              fluid ? "h-11 w-full" : "size-8",
              selected ? toneSelected[scoreTone(n)] : "bg-card hover:border-brand/40 hover:bg-brand-soft",
            )}
          >
            {n}
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        disabled={disabled}
        title="Não observado (não entra na média)"
        onClick={() => onChange(value === null ? undefined : null)}
        className={cn(
          "rounded-lg border text-xs font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
          fluid ? "h-11 w-full" : "h-8 px-2",
          value === null ? "border-foreground/60 bg-foreground/80 text-background" : "bg-card text-muted-foreground hover:bg-surface",
        )}
      >
        N/O
      </button>
    </div>
  );
}

/** Versão compacta para a tabela individual: select nativo (tab + número = rápido no teclado). */
export function ScoreSelect({
  value,
  onChange,
  disabled,
  label,
  className,
}: {
  value: Score;
  onChange: (v: Score) => void;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const str = value === undefined ? "" : value === null ? "no" : String(value);
  return (
    <select
      aria-label={label}
      value={str}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : v === "no" ? null : Number(v));
      }}
      className={cn(
        "h-9 w-full min-w-14 appearance-none rounded-lg border bg-card px-2 text-center text-sm font-medium tabular-nums outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60",
        typeof value === "number" && toneSoft[scoreTone(value)],
        value === null && "text-muted-foreground",
        className,
      )}
    >
      <option value="">–</option>
      {SCORE_VALUES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
      <option value="no">N/O</option>
    </select>
  );
}
