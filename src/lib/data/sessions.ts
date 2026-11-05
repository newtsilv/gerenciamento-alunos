import "server-only";
import { createClient } from "@/lib/supabase/server";
import { average } from "@/lib/domain/scores";
import { teamSessionState } from "@/lib/domain/constants";
import type { SessionTeam } from "@/components/sessions/session-teams";

export async function loadSessionTeams(sessionId: string, challengeId: string) {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("monitoring_sessions")
    .select("id, session_date, status, is_extra, challenge_id")
    .eq("id", sessionId)
    .eq("challenge_id", challengeId)
    .maybeSingle();
  if (!session) return null;
  const date = session.session_date;

  const [teamsRes, evalsRes, membershipsRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, project_title, active, assigned_monitor_id, monitor:profiles!teams_assigned_monitor_id_fkey(full_name)")
      .eq("challenge_id", challengeId)
      .order("name"),
    supabase
      .from("team_evaluations")
      .select("id, team_id, status, monitor:profiles!team_evaluations_monitor_id_fkey(full_name), evaluation_scores(score), student_evaluations(id, followup_status)")
      .eq("session_id", sessionId),
    supabase
      .from("team_memberships")
      .select("team_id")
      .eq("challenge_id", challengeId)
      .lte("start_date", date)
      .or(`end_date.is.null,end_date.gt.${date}`),
  ]);

  const evals = new Map((evalsRes.data ?? []).map((e) => [e.team_id, e]));
  const memberCount = new Map<string, number>();
  for (const m of membershipsRes.data ?? []) memberCount.set(m.team_id, (memberCount.get(m.team_id) ?? 0) + 1);

  const teams: SessionTeam[] = (teamsRes.data ?? [])
    .filter((t) => t.active || evals.has(t.id))
    .map((t) => {
      const e = evals.get(t.id);
      return {
        id: t.id,
        name: t.name,
        project_title: t.project_title,
        monitorId: t.assigned_monitor_id,
        monitorName: t.monitor?.full_name ?? null,
        evaluatorName: e?.monitor?.full_name ?? null,
        state: teamSessionState(e?.status),
        memberCount: memberCount.get(t.id) ?? 0,
        evaluatedStudents: e?.student_evaluations.length ?? 0,
        average: e ? average(e.evaluation_scores.map((s) => s.score)) : null,
        attention: e?.student_evaluations.filter((s) => s.followup_status && s.followup_status !== "evoluindo_bem").length ?? 0,
      };
    });

  return { session, teams };
}
