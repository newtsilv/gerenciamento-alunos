"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveAuthEmail } from "@/lib/auth-provider";
import { fail, type ActionResult } from "./result";

const loginSchema = z.object({
  login: z.string().trim().min(1, "Informe seu nome ou RA"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  next: z.string().optional(),
});

const INVALID = "Dados incorretos. Se houver outra pessoa com o mesmo nome, entre com o RA.";

export async function signIn(input: z.infer<typeof loginSchema>): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("Dados de acesso inválidos.");

  const email = await resolveAuthEmail(parsed.data.login);
  if (!email) return fail(INVALID);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) return fail(error.message === "Invalid login credentials" ? INVALID : error.message);

  const { data: claims } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", claims?.claims?.sub ?? "")
    .maybeSingle();
  if (!profile || !profile.active) {
    await supabase.auth.signOut();
    return fail("Sua conta está desativada. Procure um administrador.");
  }

  const next = parsed.data.next;
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
