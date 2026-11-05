/**
 * Cria (ou promove) um administrador.
 * Uso: npm run create-admin -- --ra 1-000000 --password "senha" --name "Nome" [--email pessoa@dominio]
 * Requer NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (lidos de .env.local).
 */
import { createClient } from "@supabase/supabase-js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const TECHNICAL_EMAIL_DOMAIN = "usuarios.acompanha.local";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");

  const ra = arg("ra")?.trim();
  const password = arg("password");
  const name = arg("name") ?? "Administrador";
  if (!ra || !password) throw new Error("Informe --ra e --password");
  if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres");
  const email = (arg("email") ?? `${ra.toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${TECHNICAL_EMAIL_DOMAIN}`).toLowerCase();

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: existing } = await supabase.from("profiles").select("id").ilike("login", ra).maybeSingle();
  let userId = existing?.id as string | undefined;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, login: ra },
    });
    if (error) throw error;
    userId = data.user.id;
  } else {
    const { error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_admin: true, active: true, login: ra, full_name: name })
    .eq("id", userId);
  if (error) throw error;
  console.log(`✔ Administrador pronto: RA ${ra} (${email})`);
}

main().catch((e) => {
  console.error("✖", e.message ?? e);
  process.exit(1);
});
