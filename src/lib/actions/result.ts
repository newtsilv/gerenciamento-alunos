import type { PostgrestError } from "@supabase/supabase-js";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Traduz erros do Postgres/Supabase para mensagens claras ao usuário */
export function dbError(error: PostgrestError | { message: string; code?: string } | null): string {
  if (!error) return "Erro desconhecido.";
  const code = "code" in error ? error.code : undefined;
  switch (code) {
    case "42501":
      return error.message?.includes("row-level security")
        ? "Você não tem permissão para realizar esta operação."
        : error.message;
    case "23505":
      return error.message?.includes("duplicate key")
        ? "Já existe um registro com esses dados."
        : error.message;
    case "23503":
      return "Este registro está vinculado a outros dados e não pode ser alterado/excluído.";
    case "23514":
      return "Dados inválidos: verifique os campos informados.";
    case "P0001":
    case "P0002":
    case "22023":
      return error.message;
    case "PGRST116":
      return "Registro não encontrado ou sem permissão de acesso.";
    default:
      return error.message || "Erro ao acessar o banco de dados.";
  }
}
