/**
 * Regras de cálculo de notas.
 * - `null` representa "Não observado": não entra na média.
 * - `undefined` representa critério não preenchido.
 * - Ausência de avaliação NUNCA é tratada como zero.
 */
export type ScoreValue = number | null | undefined;

export function average(values: ScoreValue[]): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && v >= 0 && v <= 10);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function formatAverage(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatScore(value: ScoreValue): string {
  if (value === undefined) return "—";
  if (value === null) return "N/O";
  return String(value);
}

/** Diferença entre duas médias; null quando uma delas não existe (não comparável). */
export function delta(previous: number | null, current: number | null): number | null {
  if (previous === null || current === null) return null;
  return current - previous;
}

export function formatDelta(value: number | null): string {
  if (value === null) return "—";
  const s = value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return value > 0 ? `+${s}` : s;
}

/** Média baixa serve apenas como alerta visual — a situação é sempre definida por uma pessoa. */
export function isLowAverage(value: number | null): boolean {
  return value !== null && value < 5;
}
