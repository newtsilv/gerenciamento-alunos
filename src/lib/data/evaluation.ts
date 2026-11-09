import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ServerSupabase } from "@/lib/supabase/server";

/** Integrantes da equipe na data informada (respeita o histórico de transferências). */
export async function rosterOn(supabase: ServerSupabase, teamId: string, date: string) {
  const { data, error } = await supabase
    .from("team_memberships")
    .select("id, start_date, end_date, student:students(id, full_name, registration, email)")
    .eq("team_id", teamId)
    .lte("start_date", date)
    .or(`end_date.is.null,end_date.gt.${date}`);
  if (error) throw new Error(error.message);
  return data
    .filter((m) => m.student)
    .map((m) => ({ membershipId: m.id, ...m.student! }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
}

const TEAM_EVAL_SELECT =
  "id, status, monitor_id, developed, difficulties, deliveries_completed, next_steps, general_notes, previous_difficulties_status, previous_followup_notes, submitted_at, created_at, updated_at, monitor:profiles!team_evaluations_monitor_id_fkey(full_name), evaluation_scores(criterion_id, score), student_evaluations(id, student_id, absent, followup_status, activities, deliveries, commitments, notes, difficulty, guidance, evaluation_scores(criterion_id, score))";

export async function loadEvaluationContext(sessionId: string, teamId: string) {
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("monitoring_sessions")
    .select("id, session_date, status, challenge_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, project_title, assigned_monitor_id, active, challenge_id")
    .eq("id", teamId)
    .eq("challenge_id", session.challenge_id)
    .maybeSingle();
  if (!team) return null;

  const [roster, criteriaRes, evalRes, prevRes, laterRes] = await Promise.all([
    rosterOn(supabase, teamId, session.session_date),
    supabase
      .from("evaluation_criteria")
      .select("id, scope, name, description, position, version, is_active")
      .eq("challenge_id", session.challenge_id)
      .order("position"),
    supabase.from("team_evaluations").select(TEAM_EVAL_SELECT).eq("session_id", sessionId).eq("team_id", teamId).maybeSingle(),
    supabase
      .from("team_evaluations")
      .select(`${TEAM_EVAL_SELECT}, session:monitoring_sessions!inner(session_date)`)
      .eq("team_id", teamId)
      .lt("session.session_date", session.session_date)
      .order("session(session_date)", { ascending: false })
      .limit(1),
    // integrantes atuais que entraram na equipe DEPOIS deste dia (não aparecem na avaliação)
    supabase
      .from("team_memberships")
      .select("start_date")
      .eq("team_id", teamId)
      .is("end_date", null)
      .gt("start_date", session.session_date)
      .order("start_date"),
  ]);

  const evaluation = evalRes.data;
  const later = laterRes.data ?? [];
  const previous = prevRes.data?.[0] ?? null;

  // Critérios ativos + versões antigas já usadas nesta avaliação
  const usedIds = new Set<string>([
    ...(evaluation?.evaluation_scores ?? []).map((s) => s.criterion_id),
    ...(evaluation?.student_evaluations ?? []).flatMap((se) => se.evaluation_scores.map((s) => s.criterion_id)),
  ]);
  const allCriteria = criteriaRes.data ?? [];
  const criteria = allCriteria.filter((c) => c.is_active || usedIds.has(c.id));

  // Alunos avaliados que não estão mais no roster (ex.: transferidos depois) continuam visíveis
  const rosterIds = new Set(roster.map((r) => r.id));
  const extraIds = (evaluation?.student_evaluations ?? []).map((se) => se.student_id).filter((id) => !rosterIds.has(id));
  let extras: typeof roster = [];
  if (extraIds.length) {
    const { data } = await supabase.from("students").select("id, full_name, registration, email").in("id", extraIds);
    extras = (data ?? []).map((s) => ({ membershipId: "", ...s }));
  }

  return {
    session,
    team,
    students: [...roster, ...extras],
    teamCriteria: criteria.filter((c) => c.scope === "equipe"),
    studentCriteria: criteria.filter((c) => c.scope === "aluno"),
    allCriteria,
    evaluation,
    previous,
    joinedLater: later.length ? { count: later.length, firstDate: later[0].start_date } : null,
  };
}

export type EvaluationContext = NonNullable<Awaited<ReturnType<typeof loadEvaluationContext>>>;
