import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { FollowupStatus, PreviousDifficultyStatus } from "@/lib/domain/constants";

export type ReportCriterion = { id: string; scope: "equipe" | "aluno"; name: string; position: number; version: number; is_active: boolean };

export type ReportStudentEval = {
  student_id: string;
  team_id: string;
  absent: boolean;
  followup_status: FollowupStatus | null;
  activities: string;
  deliveries: string;
  commitments: string;
  notes: string;
  difficulty: string;
  guidance: string;
  scores: Record<string, number | null>;
};

export type ReportTeamEval = {
  id: string;
  team_id: string;
  status: "rascunho" | "concluida";
  monitorName: string;
  developed: string;
  difficulties: string;
  deliveries_completed: string;
  next_steps: string;
  general_notes: string;
  previous_difficulties_status: PreviousDifficultyStatus | null;
  scores: Record<string, number | null>;
  students: ReportStudentEval[];
};

export type ReportSession = {
  id: string;
  date: string;
  evaluations: ReportTeamEval[];
  /** integrantes de cada equipe na data da sessão */
  roster: Record<string, string[]>;
};

export type ReportData = {
  challenge: { id: string; name: string; company: string };
  teams: { id: string; name: string; monitorName: string; active: boolean }[];
  students: Record<string, { name: string; registration: string | null }>;
  criteria: ReportCriterion[];
  sessions: ReportSession[];
};

/** Carrega todos os dados do período usando o cliente do usuário (RLS aplicado). */
export async function loadReportData(
  supabase: ServerSupabase,
  challengeId: string,
  from: string,
  to: string,
): Promise<ReportData | null> {
  const { data: challenge } = await supabase.from("challenges").select("id, name, company").eq("id", challengeId).maybeSingle();
  if (!challenge) return null;

  const [teamsRes, sessionsRes, criteriaRes, membershipsRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, active, monitor:profiles!teams_assigned_monitor_id_fkey(full_name)")
      .eq("challenge_id", challengeId)
      .order("name"),
    supabase
      .from("monitoring_sessions")
      .select("id, session_date")
      .eq("challenge_id", challengeId)
      .gte("session_date", from)
      .lte("session_date", to)
      .order("session_date"),
    supabase.from("evaluation_criteria").select("id, scope, name, position, version, is_active").eq("challenge_id", challengeId).order("position"),
    supabase
      .from("team_memberships")
      .select("team_id, student_id, start_date, end_date, student:students(id, full_name, registration)")
      .eq("challenge_id", challengeId)
      .lte("start_date", to)
      .or(`end_date.is.null,end_date.gt.${from}`),
  ]);

  const sessionRows = sessionsRes.data ?? [];
  const evalsRes = sessionRows.length
    ? await supabase
        .from("team_evaluations")
        .select(
          "id, session_id, team_id, status, developed, difficulties, deliveries_completed, next_steps, general_notes, previous_difficulties_status, monitor:profiles!team_evaluations_monitor_id_fkey(full_name), evaluation_scores(criterion_id, score), student_evaluations(student_id, team_id, absent, followup_status, activities, deliveries, commitments, notes, difficulty, guidance, evaluation_scores(criterion_id, score), student:students(id, full_name, registration))",
        )
        .in("session_id", sessionRows.map((s) => s.id))
    : { data: [] };

  const students: ReportData["students"] = {};
  for (const m of membershipsRes.data ?? []) {
    if (m.student) students[m.student.id] = { name: m.student.full_name, registration: m.student.registration };
  }
  for (const e of evalsRes.data ?? []) {
    for (const se of e.student_evaluations) {
      if (se.student) students[se.student.id] = { name: se.student.full_name, registration: se.student.registration };
    }
  }

  const memberships = membershipsRes.data ?? [];
  const sessions: ReportSession[] = sessionRows.map((s) => {
    const roster: Record<string, string[]> = {};
    for (const m of memberships) {
      if (m.start_date <= s.session_date && (m.end_date === null || m.end_date > s.session_date)) {
        (roster[m.team_id] ??= []).push(m.student_id);
      }
    }
    return {
      id: s.id,
      date: s.session_date,
      roster,
      evaluations: (evalsRes.data ?? [])
        .filter((e) => e.session_id === s.id)
        .map((e) => ({
          id: e.id,
          team_id: e.team_id,
          status: e.status,
          monitorName: e.monitor?.full_name ?? "",
          developed: e.developed,
          difficulties: e.difficulties,
          deliveries_completed: e.deliveries_completed,
          next_steps: e.next_steps,
          general_notes: e.general_notes,
          previous_difficulties_status: e.previous_difficulties_status,
          scores: Object.fromEntries(e.evaluation_scores.map((x) => [x.criterion_id, x.score])),
          students: e.student_evaluations.map((se) => ({
            student_id: se.student_id,
            team_id: se.team_id,
            absent: se.absent,
            followup_status: se.followup_status,
            activities: se.activities,
            deliveries: se.deliveries,
            commitments: se.commitments,
            notes: se.notes,
            difficulty: se.difficulty,
            guidance: se.guidance,
            scores: Object.fromEntries(se.evaluation_scores.map((x) => [x.criterion_id, x.score])),
          })),
        })),
    };
  });

  return {
    challenge,
    teams: (teamsRes.data ?? []).map((t) => ({ id: t.id, name: t.name, active: t.active, monitorName: t.monitor?.full_name ?? "" })),
    students,
    criteria: criteriaRes.data ?? [],
    sessions,
  };
}
