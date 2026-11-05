"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireViewer, canManageChallenge, canEvaluateChallenge } from "@/lib/auth";
import { todayISO } from "@/lib/domain/dates";
import { challengeSchema, firstError, fieldErrors, uuid, type ChallengeInput } from "@/lib/validation";
import { dbError, fail, ok, type ActionResult } from "./result";
import { z } from "zod";

export async function createChallenge(input: ChallengeInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) return fail("Apenas administradores podem criar desafios.");
  const parsed = challengeSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .insert({ ...parsed.data, created_by: viewer.id })
    .select("id")
    .single();
  if (error) return fail(dbError(error));

  revalidatePath("/desafios");
  return ok({ id: data.id }, "Desafio criado.");
}

export async function updateChallenge(id: string, input: ChallengeInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, id)) return fail("Sem permissão para editar este desafio.");
  const parsed = challengeSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("challenges").update(parsed.data).eq("id", id);
  if (error) return fail(dbError(error));

  revalidatePath(`/desafios/${id}`, "layout");
  return ok(undefined, "Desafio atualizado.");
}

export async function deleteChallenge(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) return fail("Apenas administradores podem excluir desafios.");
  const supabase = await createClient();
  const { error } = await supabase.from("challenges").delete().eq("id", id);
  if (error) return fail(dbError(error));
  // alunos que só pertenciam a este desafio deixam de existir junto com ele
  await supabase.rpc("purge_orphan_students");
  revalidatePath("/desafios");
  revalidatePath("/alunos");
  redirect("/desafios");
}

const memberSchema = z.object({
  challenge_id: uuid,
  user_id: uuid,
  role: z.enum(["coordenador", "professor", "monitor"]),
});

export async function addChallengeMember(input: z.infer<typeof memberSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  if (!canManageChallenge(viewer, parsed.data.challenge_id)) return fail("Sem permissão.");

  const supabase = await createClient();
  const { error } = await supabase.from("challenge_members").insert(parsed.data);
  if (error) {
    return fail(error.code === "23505" ? "Esta pessoa já possui este papel no desafio." : dbError(error));
  }
  revalidatePath(`/desafios/${parsed.data.challenge_id}`, "layout");
  revalidatePath("/usuarios");
  return ok(undefined, "Membro vinculado ao desafio.");
}

export async function removeChallengeMember(challengeId: string, memberId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("challenge_members").delete().eq("id", memberId).eq("challenge_id", challengeId);
  if (error) return fail(dbError(error));
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok(undefined, "Vínculo removido.");
}

/**
 * Abre (ou cria) o dia de acompanhamento escolhido livremente pelo usuário.
 * Dias fora do calendário configurado são criados na hora; datas futuras não são permitidas.
 */
export async function openSessionDay(challengeId: string, date: string): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Escolha uma data válida.");
  if (date > todayISO()) return fail("Não é possível registrar acompanhamento em uma data futura.");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("monitoring_sessions")
    .select("id")
    .eq("challenge_id", challengeId)
    .eq("session_date", date)
    .maybeSingle();
  if (existing) return ok({ id: existing.id });

  if (!canEvaluateChallenge(viewer, challengeId) && !canManageChallenge(viewer, challengeId)) {
    return fail("Ainda não há acompanhamento registrado neste dia.");
  }
  const { data, error } = await supabase
    .from("monitoring_sessions")
    .insert({ challenge_id: challengeId, session_date: date, is_extra: true })
    .select("id")
    .single();
  if (error) return fail(dbError(error));
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok({ id: data.id });
}
