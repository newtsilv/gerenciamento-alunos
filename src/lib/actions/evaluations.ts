"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth";
import { evaluationSchema, firstError, type EvaluationInput } from "@/lib/validation";
import { dbError, fail, ok, type ActionResult } from "./result";

export async function saveEvaluation(
  challengeId: string,
  input: EvaluationInput,
): Promise<ActionResult<{ id: string; savedAt: string }>> {
  await requireViewer();
  const parsed = evaluationSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const supabase = await createClient();
  // A RPC executa tudo em uma transação e aplica RLS (somente o monitor responsável grava).
  const { data, error } = await supabase.rpc("save_team_evaluation", { p: parsed.data });
  if (error) return fail(dbError(error));

  revalidatePath(`/desafios/${challengeId}`, "layout");
  revalidatePath("/dashboard");
  return ok(
    { id: data, savedAt: new Date().toISOString() },
    parsed.data.status === "concluida" ? "Acompanhamento concluído." : "Rascunho salvo.",
  );
}

export async function deleteDraftEvaluation(challengeId: string, evaluationId: string): Promise<ActionResult> {
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_evaluations")
    .delete()
    .eq("id", evaluationId)
    .eq("status", "rascunho")
    .select("id");
  if (error) return fail(dbError(error));
  if (!data?.length) return fail("Apenas rascunhos do próprio monitor podem ser descartados.");
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok(undefined, "Rascunho descartado.");
}
