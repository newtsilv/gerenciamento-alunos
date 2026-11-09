"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TECHNICAL_EMAIL_DOMAIN, technicalEmailFor, wouldBlockNameLogin } from "@/lib/auth-provider";
import { fieldErrors, firstError, userIdentitySchema, userSchema, type UserIdentityInput, type UserInput } from "@/lib/validation";
import { dbError, fail, ok, type ActionResult } from "./result";

const HOMONYM = "Já existe um usuário com este nome. Para as duas pessoas conseguirem entrar, as duas precisam ter RA.";

async function guardAdmin() {
  const viewer = await requireViewer();
  return viewer.isAdmin ? viewer : null;
}

export async function createUser(input: UserInput): Promise<ActionResult> {
  if (!(await guardAdmin())) return fail("Apenas administradores gerenciam usuários.");
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));
  const { full_name, login, email, password, is_admin } = parsed.data;

  const admin = createAdminClient();
  if (login) {
    const { data: exists } = await admin.from("profiles").select("id").ilike("login", login).maybeSingle();
    if (exists) return fail("Já existe um usuário com este RA.");
  }

  // sem RA o e-mail técnico não pode derivar dele: usa um identificador que nunca colide
  const authEmail = (email || technicalEmailFor(login || crypto.randomUUID())).toLowerCase();
  if (await wouldBlockNameLogin(full_name, { email: authEmail, login: login || null })) return fail(HOMONYM);

  const { data, error } = await admin.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name, login: login || null },
  });
  if (error) {
    return fail(error.message.includes("already been registered") ? "Este e-mail já está em uso." : error.message);
  }
  const { error: pErr } = await admin.from("profiles").update({ full_name, login: login || null, is_admin }).eq("id", data.user.id);
  if (pErr) return fail(dbError(pErr));
  revalidatePath("/usuarios");
  return ok(undefined, "Usuário criado.");
}

const updateSchema = z.object({
  full_name: z.string().trim().min(1).max(150).optional(),
  is_admin: z.boolean().optional(),
  active: z.boolean().optional(),
});

export async function updateUser(userId: string, input: z.infer<typeof updateSchema>): Promise<ActionResult> {
  const viewer = await guardAdmin();
  if (!viewer) return fail("Apenas administradores gerenciam usuários.");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  if (userId === viewer.id && (parsed.data.is_admin === false || parsed.data.active === false)) {
    return fail("Você não pode remover seu próprio acesso de administrador.");
  }
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return fail(dbError(error));
  if (parsed.data.active === false) {
    // encerra sessões ativas do usuário desativado
    await admin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
  } else if (parsed.data.active === true) {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  }
  revalidatePath("/usuarios");
  return ok(undefined, "Usuário atualizado.");
}

export async function resetPassword(userId: string, password: string): Promise<ActionResult> {
  if (!(await guardAdmin())) return fail("Apenas administradores gerenciam usuários.");
  if (password.length < 6) return fail("A senha deve ter pelo menos 6 caracteres.");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return fail(error.message);
  return ok(undefined, "Senha redefinida.");
}

/** Corrige nome e RA. Para contas com e-mail técnico, o e-mail de login acompanha o novo RA. */
export async function updateUserIdentity(userId: string, input: UserIdentityInput): Promise<ActionResult> {
  if (!(await guardAdmin())) return fail("Apenas administradores gerenciam usuários.");
  const parsed = userIdentitySchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));
  const { full_name, login } = parsed.data;

  const admin = createAdminClient();
  const { data: current } = await admin.from("profiles").select("id, login, email").eq("id", userId).maybeSingle();
  if (!current) return fail("Usuário não encontrado.");
  if (login) {
    const { data: clash } = await admin.from("profiles").select("id").ilike("login", login).neq("id", userId).maybeSingle();
    if (clash) return fail("Já existe outro usuário com este RA.");
  }
  if (await wouldBlockNameLogin(full_name, { id: userId, email: current.email, login: login || null })) return fail(HOMONYM);

  let email = current.email as string;
  // ao remover o RA, o e-mail técnico deixa de derivar dele para o RA poder ser reutilizado
  if (email.endsWith(`@${TECHNICAL_EMAIL_DOMAIN}`) && (login || current.login)) {
    email = technicalEmailFor(login || crypto.randomUUID());
    if (email !== current.email) {
      const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true, user_metadata: { full_name, login: login || null } });
      if (error) return fail(error.message);
    }
  }
  const { error } = await admin.from("profiles").update({ full_name, login: login || null, email }).eq("id", userId);
  if (error) return fail(dbError(error));
  revalidatePath("/usuarios");
  return ok(undefined, "Dados atualizados.");
}
