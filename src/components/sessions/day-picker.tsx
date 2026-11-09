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
  const s = format(parseISO(date), "EEEE", { locale: ptBR }).replace(/-feira$/, "");
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
  const [showOther, setShowOther] = useState(false);
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
    <section className={cn("rounded-2xl border bg-card", compact ? "p-4" : "p-4 sm:p-6")}>
      {!compact && (
        <div className="mb-3 flex items-start gap-3 sm:mb-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand max-sm:hidden">
            <CalendarDaysIcon className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold sm:text-lg">Qual dia você vai registrar?</h2>
            <p className="text-sm text-muted-foreground max-sm:hidden">Pode ser hoje ou um dia anterior. Toque em um dia para abrir as equipes.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {shortcuts.map((d, i) => {
          // "Hoje"/"Ontem" já não dizem a data; os demais atalhos são sempre dias previstos
          const showScheduled = i < 2 && scheduledDates.includes(d);
          return (
            <button
              key={d}
              type="button"
              disabled={!!opening}
              onClick={() => open(d)}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-xl border px-2 transition-all active:scale-95 disabled:opacity-60 sm:min-w-24 sm:px-4",
                d === today ? "border-brand bg-brand text-primary-foreground hover:bg-brand/90 max-sm:col-span-3" : "bg-card hover:border-brand/40 hover:bg-brand-soft",
                i > 3 && "max-sm:hidden",
              )}
            >
              {opening === d ? (
                <Loader2Icon className="size-5 animate-spin" />
              ) : (
                <>
                  <span className="text-sm font-semibold">{dayLabel(d, today)}</span>
                  <span className={cn("text-xs", d === today ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {format(parseISO(d), "dd/MM")}
                    {showScheduled && " · previsto"}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {!showOther && (
        <button type="button" onClick={() => setShowOther(true)} className="mt-2 h-9 text-sm font-medium text-brand sm:hidden">
          Escolher outro dia
        </button>
      )}

      <form
        className={cn("mt-4 flex-col gap-2 border-t pt-4 sm:flex sm:flex-row sm:items-center", showOther ? "flex animate-pop-in sm:animate-none" : "hidden")}
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
