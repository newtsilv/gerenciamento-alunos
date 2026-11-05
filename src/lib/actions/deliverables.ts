"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireViewer, canManageChallenge } from "@/lib/auth";
import {
  deliverableSchema,
  fieldErrors,
  firstError,
  milestoneSchema,
  type DeliverableInput,
  type MilestoneInput,
} from "@/lib/validation";
import { dbError, fail, ok, type ActionResult } from "./result";

const statusSchema = z.enum(["nao_iniciada", "em_andamento", "concluida", "bloqueada"]);

const DEFAULT_MILESTONES = [
  "Levantamento de requisitos",
  "Prototipação",
  "Desenvolvimento do frontend",
  "Desenvolvimento do backend",
  "Integração",
  "Testes",
  "Apresentação final",
];

function revalidate(challengeId: string) {
  revalidatePath(`/desafios/${challengeId}`, "layout");
}

export async function createMilestone(challengeId: string, input: MilestoneInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));
  const supabase = await createClient();
  const { count } = await supabase.from("project_milestones").select("id", { count: "exact", head: true }).eq("challenge_id", challengeId);
  const { error } = await supabase.from("project_milestones").insert({ ...parsed.data, challenge_id: challengeId, position: count ?? 0 });
  if (error) return fail(dbError(error));
  revalidate(challengeId);
  return ok(undefined, "Marco criado e aplicado a todas as equipes.");
}

export async function addDefaultMilestones(challengeId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { data: existing } = await supabase.from("project_milestones").select("title").eq("challenge_id", challengeId);
  const have = new Set((existing ?? []).map((m) => m.title.toLowerCase()));
  const rows = DEFAULT_MILESTONES.filter((t) => !have.has(t.toLowerCase())).map((title, i) => ({
    challenge_id: challengeId,
    title,
    position: (existing?.length ?? 0) + i,
  }));
  if (!rows.length) return ok(undefined, "Os marcos sugeridos já existem.");
  const { error } = await supabase.from("project_milestones").insert(rows);
  if (error) return fail(dbError(error));
  revalidate(challengeId);
  return ok(undefined, `${rows.length} marco(s) adicionados.`);
}

export async function updateMilestone(challengeId: string, id: string, input: MilestoneInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const parsed = milestoneSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("project_milestones").update(parsed.data).eq("id", id).eq("challenge_id", challengeId);
  if (error) return fail(dbError(error));
  revalidate(challengeId);
  return ok(undefined, "Marco atualizado.");
}

export async function deleteMilestone(challengeId: string, id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("project_milestones").delete().eq("id", id).eq("challenge_id", challengeId);
  if (error) return fail(dbError(error));
  revalidate(challengeId);
  return ok(undefined, "Marco excluído.");
}

export async function setDeliverableStatus(challengeId: string, id: string, status: string): Promise<ActionResult> {
  await requireViewer();
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return fail("Status inválido.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_deliverables").update({ status: parsed.data }).eq("id", id).select("id");
  if (error) return fail(dbError(error));
  if (!data?.length) return fail("Sem permissão para alterar esta entrega.");
  revalidate(challengeId);
  return ok(undefined, "Entrega atualizada.");
}

export async function saveDeliverable(
  challengeId: string,
  teamId: string,
  id: string | null,
  input: DeliverableInput,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = deliverableSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from("team_deliverables").update(parsed.data).eq("id", id).select("id");
    if (error) return fail(dbError(error));
    if (!data?.length) return fail("Sem permissão para alterar esta entrega.");
  } else {
    if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão para criar entregas.");
    const { error } = await supabase.from("team_deliverables").insert({ ...parsed.data, team_id: teamId });
    if (error) return fail(dbError(error));
  }
  revalidate(challengeId);
  return ok(undefined, "Entrega salva.");
}

export async function deleteDeliverable(challengeId: string, id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("team_deliverables").delete().eq("id", id);
  if (error) return fail(dbError(error));
  revalidate(challengeId);
  return ok(undefined, "Entrega excluída.");
}
