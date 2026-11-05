"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer, canManageChallenge } from "@/lib/auth";
import { dbError, fail, ok, type ActionResult } from "./result";

async function guard(challengeId: string) {
  const viewer = await requireViewer();
  return canManageChallenge(viewer, challengeId);
}

function validName(name: string) {
  const n = name.trim();
  return n.length > 0 && n.length <= 120 ? n : null;
}

export async function createCriterion(challengeId: string, scope: "equipe" | "aluno", name: string, description: string): Promise<ActionResult> {
  if (!(await guard(challengeId))) return fail("Sem permissão.");
  const n = validName(name);
  if (!n) return fail("Informe um nome (até 120 caracteres).");
  if (scope !== "equipe" && scope !== "aluno") return fail("Tipo inválido.");
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("evaluation_criteria")
    .select("position")
    .eq("challenge_id", challengeId)
    .eq("scope", scope)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("evaluation_criteria")
    .insert({ challenge_id: challengeId, scope, name: n, description: description.trim().slice(0, 1000), position: (last?.position ?? 0) + 1 });
  if (error) return fail(dbError(error));
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok(undefined, "Critério criado.");
}

export async function editCriterion(challengeId: string, id: string, name: string, description: string): Promise<ActionResult> {
  if (!(await guard(challengeId))) return fail("Sem permissão.");
  const n = validName(name);
  if (!n) return fail("Informe um nome (até 120 caracteres).");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_criterion", { p_criterion_id: id, p_name: n, p_description: description.trim().slice(0, 1000) });
  if (error) return fail(dbError(error));
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok(undefined, data !== id ? "Nova versão do critério criada (histórico preservado)." : "Critério atualizado.");
}

export async function setCriterionActive(challengeId: string, id: string, active: boolean): Promise<ActionResult> {
  if (!(await guard(challengeId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("evaluation_criteria").update({ is_active: active }).eq("id", id).eq("challenge_id", challengeId);
  if (error) return fail(dbError(error));
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok(undefined, active ? "Critério reativado." : "Critério desativado. Avaliações anteriores não são afetadas.");
}

export async function moveCriterion(challengeId: string, id: string, direction: -1 | 1): Promise<ActionResult> {
  if (!(await guard(challengeId))) return fail("Sem permissão.");
  const supabase = await createClient();
  const { data: c } = await supabase.from("evaluation_criteria").select("scope").eq("id", id).single();
  const { data: list } = await supabase
    .from("evaluation_criteria")
    .select("id, position")
    .eq("challenge_id", challengeId)
    .eq("scope", c?.scope ?? "equipe")
    .eq("is_active", true)
    .order("position");
  if (!list) return fail("Critério não encontrado.");
  const idx = list.findIndex((x) => x.id === id);
  const swap = list[idx + direction];
  if (idx < 0 || !swap) return ok(undefined);
  const reordered = [...list];
  [reordered[idx], reordered[idx + direction]] = [reordered[idx + direction], reordered[idx]];
  for (const [i, item] of reordered.entries()) {
    if (item.position !== i + 1) {
      const { error } = await supabase.from("evaluation_criteria").update({ position: i + 1 }).eq("id", item.id);
      if (error) return fail(dbError(error));
    }
  }
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok(undefined, "Ordem atualizada.");
}
