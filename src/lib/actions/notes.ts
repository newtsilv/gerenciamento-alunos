"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer, canViewChallenge } from "@/lib/auth";
import { dbError, fail, ok, type ActionResult } from "./result";

export async function addPedagogicalNote(
  challengeId: string,
  teamId: string,
  content: string,
  studentId?: string | null,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canViewChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const text = content.trim();
  if (!text) return fail("Escreva a observação.");
  if (text.length > 4000) return fail("Observação muito longa (máx. 4000 caracteres).");

  const supabase = await createClient();
  const { error } = await supabase.from("pedagogical_notes").insert({
    challenge_id: challengeId,
    team_id: teamId,
    student_id: studentId || null,
    author_id: viewer.id,
    content: text,
  });
  if (error) return fail(dbError(error));
  revalidatePath(`/desafios/${challengeId}/equipes/${teamId}`);
  return ok(undefined, "Observação registrada.");
}

export async function deletePedagogicalNote(challengeId: string, teamId: string, noteId: string): Promise<ActionResult> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.from("pedagogical_notes").delete().eq("id", noteId).select("id");
  if (error) return fail(dbError(error));
  if (!data?.length) return fail("Você só pode excluir suas próprias observações.");
  revalidatePath(`/desafios/${challengeId}/equipes/${teamId}`);
  return ok(undefined, "Observação excluída.");
}
