import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Camada de identidade: resolve o identificador digitado no login (RA ou e-mail)
 * para a conta no Supabase Auth.
 *
 * Integração futura com o TOTVS RM:
 *   1. Validar RA + senha na API do RM (ex.: endpoint de autenticação do RM).
 *   2. Se válido, criar/atualizar o usuário no Supabase via service role
 *      (auth_source = 'rm'), sincronizando nome e e-mail.
 *   3. Abrir a sessão no Supabase para esse usuário.
 * Apenas este arquivo e `signIn` (lib/actions/auth.ts) precisam mudar; RLS,
 * permissões e telas continuam baseados no perfil do Supabase.
 */

export const TECHNICAL_EMAIL_DOMAIN = "usuarios.acompanha.local";

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase();
}

/** E-mail técnico para usuários sem e-mail (o Supabase Auth exige um e-mail). */
export function technicalEmailFor(login: string): string {
  const safe = normalizeLogin(login).replace(/[^a-z0-9._-]/g, "");
  return `${safe}@${TECHNICAL_EMAIL_DOMAIN}`;
}

/**
 * Retorna o e-mail de autenticação a partir do RA (ou do próprio e-mail).
 * Executado apenas no servidor, com service role, para não expor a lista
 * de usuários a clientes anônimos.
 */
export async function resolveAuthEmail(identifier: string): Promise<string | null> {
  const value = identifier.trim();
  if (!value) return null;
  if (value.includes("@")) return value.toLowerCase();

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .ilike("login", value.replace(/[%_]/g, "\\$&"))
    .maybeSingle();
  return data?.email ?? null;
}
