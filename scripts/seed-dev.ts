/**
 * Usuários de TESTE para desenvolvimento/testes automatizados (não usar em produção).
 * Não cria desafios: os testes E2E criam e excluem o próprio desafio.
 * Uso: npm run seed:dev   (senha padrão dos usuários de teste: teste123)
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Configure .env.local");
if (!/127\.0\.0\.1|localhost/.test(url) && !process.argv.includes("--force")) {
  throw new Error("Seed de desenvolvimento só roda no Supabase local (use --force para ignorar).");
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const PASSWORD = "teste123";

const users = [
  { login: "coord01", name: "Carla Coordenadora", role: "coordenador" },
  { login: "prof01", name: "Paulo Professor", role: "professor" },
  { login: "mon01", name: "Marina Monitora", role: "monitor" },
  { login: "mon02", name: "Marcos Monitor", role: "monitor" },
] as const;

async function ensureUser(login: string, name: string) {
  const { data: existing } = await supabase.from("profiles").select("id").eq("login", login).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase.auth.admin.createUser({
    email: `${login}@usuarios.acompanha.local`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, login },
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const ids: Record<string, string> = {};
  for (const u of users) ids[u.login] = await ensureUser(u.login, u.name);
  const adminId = await ensureUser("admin01", "Administrador de Teste");
  await supabase.from("profiles").update({ is_admin: true }).eq("id", adminId);

  console.log("✔ Usuários de teste prontos.");
  console.log(`  Usuários (senha ${PASSWORD}): admin01 (administrador), ${users.map((u) => `${u.login} (${u.role})`).join(", ")}`);
}

main().catch((e) => {
  console.error("✖", e.message ?? e);
  process.exit(1);
});
