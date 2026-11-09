"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireViewer, canManageChallenge } from "@/lib/auth";
import { todayISO } from "@/lib/domain/dates";
import {
  fieldErrors,
  firstError,
  studentSchema,
  teamSchema,
  transferSchema,
  isoDate,
  type StudentInput,
  type TeamInput,
  type TransferInput,
} from "@/lib/validation";
import { dbError, fail, ok, type ActionResult } from "./result";

function revalidateChallenge(challengeId: string) {
  revalidatePath(`/desafios/${challengeId}`, "layout");
}

export async function createTeam(challengeId: string, input: TeamInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão para cadastrar equipes.");
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({ ...parsed.data, challenge_id: challengeId })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "Já existe uma equipe com esse nome neste desafio." : dbError(error));
  revalidateChallenge(challengeId);
  return ok({ id: data.id }, "Equipe cadastrada.");
}

export async function updateTeam(challengeId: string, teamId: string, input: TeamInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão para editar equipes.");
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.from("teams").update(parsed.data).eq("id", teamId).eq("challenge_id", challengeId);
  if (error) return fail(error.code === "23505" ? "Já existe uma equipe com esse nome neste desafio." : dbError(error));
  revalidateChallenge(challengeId);
  return ok(undefined, "Equipe atualizada.");
}

export async function assignMonitor(challengeId: string, teamId: string, monitorId: string | null): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("teams")
    .update({ assigned_monitor_id: monitorId || null })
    .eq("id", teamId)
    .eq("challenge_id", challengeId);
  if (error) return fail(dbError(error));
  revalidateChallenge(challengeId);
  return ok(undefined, "Monitor atribuído.");
}

/** Distribui as equipes sem monitor entre os monitores do desafio (rodízio). */
export async function distributeTeams(challengeId: string): Promise<ActionResult<{ assigned: number }>> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const [{ data: monitors }, { data: teams }] = await Promise.all([
    supabase.from("challenge_members").select("user_id").eq("challenge_id", challengeId).eq("role", "monitor"),
    supabase.from("teams").select("id, assigned_monitor_id").eq("challenge_id", challengeId).eq("active", true).order("name"),
  ]);
  if (!monitors?.length) return fail("Vincule monitores ao desafio antes de distribuir as equipes.");

  const load = new Map(monitors.map((m) => [m.user_id, 0]));
  for (const t of teams ?? []) if (t.assigned_monitor_id && load.has(t.assigned_monitor_id)) load.set(t.assigned_monitor_id, load.get(t.assigned_monitor_id)! + 1);

  let assigned = 0;
  for (const t of teams ?? []) {
    if (t.assigned_monitor_id && load.has(t.assigned_monitor_id)) continue;
    const [monitorId] = [...load.entries()].sort((a, b) => a[1] - b[1])[0];
    const { error } = await supabase.from("teams").update({ assigned_monitor_id: monitorId }).eq("id", t.id);
    if (error) return fail(dbError(error));
    load.set(monitorId, load.get(monitorId)! + 1);
    assigned++;
  }
  revalidateChallenge(challengeId);
  return ok({ assigned }, assigned ? `${assigned} equipe(s) distribuída(s).` : "Todas as equipes já possuem monitor.");
}

export async function deleteTeam(challengeId: string, teamId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { count } = await supabase.from("team_evaluations").select("id", { count: "exact", head: true }).eq("team_id", teamId);
  if (count) {
    // Preserva histórico: equipes com avaliações são apenas desativadas
    const { error } = await supabase.from("teams").update({ active: false }).eq("id", teamId);
    if (error) return fail(dbError(error));
    revalidateChallenge(challengeId);
    return ok(undefined, "A equipe possui avaliações e foi desativada (histórico preservado).");
  }
  const { error } = await supabase.from("teams").delete().eq("id", teamId).eq("challenge_id", challengeId);
  if (error) return fail(dbError(error));
  revalidateChallenge(challengeId);
  return ok(undefined, "Equipe excluída.");
}

export async function reactivateTeam(challengeId: string, teamId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { error } = await supabase.from("teams").update({ active: true }).eq("id", teamId);
  if (error) return fail(dbError(error));
  revalidateChallenge(challengeId);
  return ok(undefined, "Equipe reativada.");
}

export async function addStudentToTeam(
  challengeId: string,
  teamId: string,
  input: StudentInput & { existing_student_id?: string | null; start_date?: string },
): Promise<ActionResult<{ studentId: string }>> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  if (!input.existing_student_id) {
    const parsed = studentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));
  }
  const startDate = input.start_date && isoDate.safeParse(input.start_date).success ? input.start_date : todayISO();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_student_to_team", {
    p_team_id: teamId,
    p_full_name: input.full_name,
    p_registration: input.registration || undefined,
    p_email: input.email || undefined,
    p_existing_student_id: input.existing_student_id || undefined,
    p_start_date: startDate,
  });
  if (error) return fail(dbError(error));
  revalidateChallenge(challengeId);
  return ok({ studentId: data }, "Aluno adicionado à equipe.");
}

export async function transferStudent(challengeId: string, input: TransferInput): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão para transferir alunos.");
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_student", {
    p_student_id: parsed.data.student_id,
    p_to_team_id: parsed.data.to_team_id,
    p_date: parsed.data.date,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return fail(dbError(error));
  revalidateChallenge(challengeId);
  revalidatePath("/alunos", "layout");
  return ok(undefined, "Aluno transferido. O histórico de avaliações foi preservado.");
}

export async function removeStudentFromTeam(
  challengeId: string,
  membershipId: string,
  date: string,
  reason: string,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  if (!isoDate.safeParse(date).success) return fail("Data inválida.");

  const supabase = await createClient();
  const { data: m } = await supabase.from("team_memberships").select("start_date").eq("id", membershipId).single();
  if (m && date < m.start_date) return fail("A data de saída não pode ser anterior à entrada na equipe.");

  const { error } = await supabase
    .from("team_memberships")
    .update({ end_date: date, ended_by: viewer.id, end_reason: reason.trim() || "Removido da equipe" })
    .eq("id", membershipId)
    .eq("challenge_id", challengeId)
    .is("end_date", null);
  if (error) return fail(dbError(error));
  revalidateChallenge(challengeId);
  return ok(undefined, "Aluno removido da equipe. O histórico foi mantido.");
}

export async function updateStudent(studentId: string, input: StudentInput): Promise<ActionResult> {
  await requireViewer();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error), fieldErrors(parsed.error));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({
      full_name: parsed.data.full_name,
      registration: parsed.data.registration || null,
      email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
      notes: parsed.data.notes ?? "",
    })
    .eq("id", studentId)
    .select("id");
  if (error) return fail(error.code === "23505" ? "Já existe um aluno com esta matrícula." : dbError(error));
  if (!data?.length) return fail("Você não tem permissão para editar este aluno.");
  revalidatePath("/alunos", "layout");
  revalidatePath("/desafios", "layout");
  return ok(undefined, "Dados do aluno atualizados.");
}

/**
 * Corrige a data de entrada dos integrantes atuais da equipe para o início do desafio.
 * Só altera alunos com um único vínculo no desafio (sem transferências), preservando o histórico.
 */
export async function backdateTeamMembers(challengeId: string, teamId: string): Promise<ActionResult<{ updated: number }>> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Peça à supervisão para ajustar a data de entrada dos alunos.");
  const supabase = await createClient();
  const { data: challenge } = await supabase.from("challenges").select("start_date").eq("id", challengeId).single();
  if (!challenge) return fail("Desafio não encontrado.");

  const { data: current } = await supabase
    .from("team_memberships")
    .select("id, student_id, start_date")
    .eq("team_id", teamId)
    .is("end_date", null)
    .gt("start_date", challenge.start_date);
  if (!current?.length) return ok({ updated: 0 }, "Nenhum ajuste necessário.");

  const { data: all } = await supabase
    .from("team_memberships")
    .select("student_id")
    .eq("challenge_id", challengeId)
    .in("student_id", current.map((m) => m.student_id));
  const count = new Map<string, number>();
  for (const m of all ?? []) count.set(m.student_id, (count.get(m.student_id) ?? 0) + 1);
  const ids = current.filter((m) => count.get(m.student_id) === 1).map((m) => m.id);
  if (!ids.length) return fail("Os integrantes desta equipe vieram de transferências; ajuste não aplicado para preservar o histórico.");

  const { error } = await supabase.from("team_memberships").update({ start_date: challenge.start_date }).in("id", ids);
  if (error) return fail(dbError(error));
  revalidateChallenge(challengeId);
  return ok({ updated: ids.length }, `${ids.length} aluno(s) agora constam na equipe desde o início do desafio.`);
}
