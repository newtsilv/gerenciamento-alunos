"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRightIcon, CalendarDaysIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openSessionDay } from "@/lib/actions/challenges";
import { cn } from "@/lib/utils";

function dayLabel(date: string, today: string) {
  if (date === today) return "Hoje";
  if (date === format(addDays(parseISO(today), -1), "yyyy-MM-dd")) return "Ontem";
  const s = format(parseISO(date), "EEE dd/MM", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Ponto único de entrada: o usuário escolhe livremente o dia do acompanhamento.
 * Atalhos para hoje, ontem e os últimos dias previstos; qualquer outra data pelo calendário.
 */
export function DayPicker({
  challengeId,
  today,
  scheduledDates,
  compact,
}: {
  challengeId: string;
  today: string;
  /** dias previstos no calendário do desafio (até hoje) */
  scheduledDates: string[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const yesterday = format(addDays(parseISO(today), -1), "yyyy-MM-dd");
  const recent = [...scheduledDates].filter((d) => d < yesterday).sort().reverse().slice(0, compact ? 2 : 3);
  const shortcuts = [today, yesterday, ...recent];

  function open(date: string) {
    if (!date) return;
    setOpening(date);
    startTransition(async () => {
      const r = await openSessionDay(challengeId, date);
      if (!r.ok) {
        toast.error(r.error);
        setOpening(null);
        return;
      }
      router.push(`/desafios/${challengeId}/acompanhamentos/${r.data.id}`);
    });
  }

  return (
    <section className={cn("rounded-2xl border bg-card", compact ? "p-4" : "p-5 sm:p-6")}>
      {!compact && (
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <CalendarDaysIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Qual dia você vai registrar?</h2>
            <p className="text-sm text-muted-foreground">Pode ser hoje ou um dia anterior. Toque em um dia para abrir as equipes.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {shortcuts.map((d) => {
          const scheduled = scheduledDates.includes(d);
          return (
            <button
              key={d}
              type="button"
              disabled={!!opening}
              onClick={() => open(d)}
              className={cn(
                "flex h-14 min-w-24 flex-col items-center justify-center rounded-xl border px-4 transition-all active:scale-95 disabled:opacity-60",
                d === today ? "border-brand bg-brand text-primary-foreground hover:bg-brand/90" : "bg-card hover:border-brand/40 hover:bg-brand-soft",
              )}
            >
              {opening === d ? (
                <Loader2Icon className="size-5 animate-spin" />
              ) : (
                <>
                  <span className="text-sm font-semibold">{dayLabel(d, today)}</span>
                  <span className={cn("text-xs", d === today ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {format(parseISO(d), "dd/MM")}
                    {scheduled && " · previsto"}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <form
        className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          open(custom);
        }}
      >
        <label htmlFor={`outro-dia-${challengeId}`} className="text-sm text-muted-foreground sm:w-24">
          Outro dia:
        </label>
        <Input
          id={`outro-dia-${challengeId}`}
          type="date"
          max={today}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="sm:w-48"
        />
        <Button type="submit" variant="outline" disabled={!custom || !!opening}>
          {opening === custom && custom ? <Loader2Icon className="animate-spin" /> : <ArrowRightIcon />}
          Abrir dia
        </Button>
      </form>
    </section>
  );
}
