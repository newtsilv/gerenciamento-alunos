import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no fuso horário da aplicação */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Converte "YYYY-MM-DD" em Date local (sem deslocamento de fuso) */
export function fromISODate(value: string): Date {
  return parseISO(value);
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function formatDate(value: string | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!value) return "—";
  const d = value.length <= 10 ? parseISO(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, pattern, { locale: ptBR });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export function formatWeekday(value: string): string {
  return format(parseISO(value), "EEEE", { locale: ptBR });
}

/** Semana (segunda a domingo) que contém a data */
export function weekRange(value: string): { start: string; end: string } {
  const start = startOfWeek(parseISO(value), { weekStartsOn: 1 });
  return { start: toISODate(start), end: toISODate(addDays(start, 6)) };
}

export function isISODate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISO(value).getTime());
}
