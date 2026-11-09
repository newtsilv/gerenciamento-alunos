import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Camada de identidade: resolve o identificador digitado no login (RA, nome ou e-mail)
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

/** Ignora maiúsculas, acentos e espaços repetidos: "joão  silva" equivale a "Joao Silva". */
function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
}

type LoginAccount = { id?: string; email: string; login: string | null };

/** Conta sem RA e sem e-mail real: o nome completo é a única forma de entrar. */
function dependsOnName(account: LoginAccount) {
  return !account.login && account.email.endsWith(`@${TECHNICAL_EMAIL_DOMAIN}`);
}

/** Com homônimos o login por nome não funciona; recusa o cadastro se alguém ficaria sem como entrar. */
export async function wouldBlockNameLogin(fullName: string, account: LoginAccount): Promise<boolean> {
  const { data } = await createAdminClient().from("profiles").select("id, email, login, full_name");
  const name = normalizeName(fullName);
  const homonyms = (data ?? []).filter((profile) => profile.id !== account.id && normalizeName(profile.full_name) === name);
  return homonyms.length > 0 && [account, ...homonyms].some(dependsOnName);
}

/**
 * Retorna o e-mail de autenticação a partir do RA, do nome completo ou do próprio e-mail.
 * Executado apenas no servidor, com service role, para não expor a lista
 * de usuários a clientes anônimos.
 */
export async function resolveAuthEmail(identifier: string): Promise<string | null> {
  const value = identifier.trim();
  if (!value) return null;
  if (value.includes("@")) return value.toLowerCase();

  const admin = createAdminClient();
  const { data: byLogin } = await admin
    .from("profiles")
    .select("email")
    .ilike("login", value.replace(/[%_]/g, "\\$&"))
    .maybeSingle();
  if (byLogin) return byLogin.email;

  // nomes não são únicos: com homônimos, só o RA identifica a conta
  const { data: profiles } = await admin.from("profiles").select("email, full_name");
  const name = normalizeName(value);
  const matches = (profiles ?? []).filter((profile) => normalizeName(profile.full_name) === name);
  return matches.length === 1 ? matches[0].email : null;
}
