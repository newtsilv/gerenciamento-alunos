import "server-only";
import { createClient } from "@/lib/supabase/server";
import { average } from "@/lib/domain/scores";
import { todayISO } from "@/lib/domain/dates";
import type { DeliverableStatus, FollowupStatus } from "@/lib/domain/constants";

export type DashboardFilters = {
  challengeId?: string;
  teamId?: string;
  monitorId?: string;
  from?: string;
  to?: string;
  situation?: FollowupStatus;
};

export type AttentionTeam = {
  teamId: string;
  teamName: string;
  challengeId: string;
  challengeName: string;
  lastDate: string;
  average: number | null;
  flagged: { name: string; status: FollowupStatus }[];
  difficulties: string;
  previousUnresolved: boolean;
};

export async function loadDashboard(filters: DashboardFilters) {
  const supabase = await createClient();
  const today = todayISO();

  let chQuery = supabase.from("challenges").select("id, name, status, start_date, end_date");
  if (filters.challengeId) chQuery = chQuery.eq("id", filters.challengeId);
  const { data: challenges = [] } = await chQuery;
  const challengeList = challenges ?? [];
  const scopeIds = filters.challengeId ? challengeList.map((c) => c.id) : challengeList.filter((c) => c.status === "ativo").map((c) => c.id);
  const challengeName = new Map(challengeList.map((c) => [c.id, c.name]));

  if (!scopeIds.length) {
    return emptyDashboard(challengeList);
  }

  let teamsQuery = supabase
    .from("teams")
    .select("id, name, challenge_id, assigned_monitor_id, active")
    .in("challenge_id", scopeIds)
    .eq("active", true);
  if (filters.teamId) teamsQuery = teamsQuery.eq("id", filters.teamId);
  if (filters.monitorId) teamsQuery = teamsQuery.eq("assigned_monitor_id", filters.monitorId);
  const { data: teamsData } = await teamsQuery;
  const teams = teamsData ?? [];
  const teamIds = teams.map((t) => t.id);
  const teamName = new Map(teams.map((t) => [t.id, t.name]));

  let sessionsQuery = supabase
    .from("monitoring_sessions")
    .select("id, challenge_id, session_date")
    .in("challenge_id", scopeIds)
    .lte("session_date", filters.to && filters.to < today ? filters.to : today)
    .order("session_date");
  if (filters.from) sessionsQuery = sessionsQuery.gte("session_date", filters.from);
  const { data: sessionsData } = await sessionsQuery;
  const sessions = sessionsData ?? [];
  const sessionDate = new Map(sessions.map((s) => [s.id, s.session_date]));

  const [evalsRes, membershipsRes, deliverablesRes, studentsCountRes] = await Promise.all([
    sessions.length && teamIds.length
      ? supabase
          .from("team_evaluations")
          .select(
            "id, team_id, challenge_id, session_id, status, monitor_id, difficulties, previous_difficulties_status, evaluation_scores(score), student_evaluations(student_id, followup_status, absent, evaluation_scores(score), student:students(full_name))",
          )
          .in("session_id", sessions.map((s) => s.id))
          .in("team_id", teamIds)
      : Promise.resolve({ data: [] as never[] }),
    teamIds.length
      ? supabase.from("team_memberships").select("team_id, student_id").in("team_id", teamIds).is("end_date", null)
      : Promise.resolve({ data: [] as { team_id: string; student_id: string }[] }),
    teamIds.length
      ? supabase.from("team_deliverables").select("team_id, status, due_date").in("team_id", teamIds)
      : Promise.resolve({ data: [] as { team_id: string; status: DeliverableStatus; due_date: string | null }[] }),
    Promise.resolve(null),
  ]);
  void studentsCountRes;

  const evals = (evalsRes.data ?? []) as {
    id: string;
    team_id: string;
    challenge_id: string;
    session_id: string;
    status: "rascunho" | "concluida";
    monitor_id: string;
    difficulties: string;
    previous_difficulties_status: string | null;
    evaluation_scores: { score: number | null }[];
    student_evaluations: {
      student_id: string;
      followup_status: FollowupStatus | null;
      absent: boolean;
      evaluation_scores: { score: number | null }[];
      student: { full_name: string } | null;
    }[];
  }[];

  // ---- indicadores de acompanhamentos
  const teamsByChallenge = new Map<string, number>();
  for (const t of teams) teamsByChallenge.set(t.challenge_id, (teamsByChallenge.get(t.challenge_id) ?? 0) + 1);
  const expected = sessions.reduce((n, s) => n + (teamsByChallenge.get(s.challenge_id) ?? 0), 0);
  const done = evals.filter((e) => e.status === "concluida").length;
  const drafts = evals.filter((e) => e.status === "rascunho").length;

  const memberships = membershipsRes.data ?? [];
  const studentCount = new Set(memberships.map((m) => m.student_id)).size;

  // ---- evolução: média coletiva e individual por data
  const byDate = new Map<string, { team: (number | null)[]; student: (number | null)[]; count: number }>();
  for (const e of evals) {
    const date = sessionDate.get(e.session_id)!;
    const entry = byDate.get(date) ?? { team: [], student: [], count: 0 };
    entry.team.push(...e.evaluation_scores.map((s) => s.score));
    for (const se of e.student_evaluations) entry.student.push(...se.evaluation_scores.map((s) => s.score));
    entry.count += e.status === "concluida" ? 1 : 0;
    byDate.set(date, entry);
  }
  const evolution = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      equipes: round(average(v.team)),
      alunos: round(average(v.student)),
      concluidas: v.count,
    }));

  // ---- situação dos alunos (última avaliação de cada aluno)
  const lastStudent = new Map<string, { date: string; status: FollowupStatus | null; name: string; teamId: string }>();
  for (const e of evals) {
    const date = sessionDate.get(e.session_id)!;
    for (const se of e.student_evaluations) {
      const cur = lastStudent.get(se.student_id);
      if (!cur || cur.date < date) {
        lastStudent.set(se.student_id, { date, status: se.followup_status, name: se.student?.full_name ?? "", teamId: e.team_id });
      }
    }
  }
  const situation = { evoluindo_bem: 0, precisa_atencao: 0, necessita_intervencao: 0, sem_situacao: 0 };
  for (const v of lastStudent.values()) {
    if (v.status) situation[v.status]++;
    else situation.sem_situacao++;
  }
  const notEvaluatedStudents = Math.max(0, studentCount - lastStudent.size);

  // ---- equipes que precisam de atenção (última avaliação de cada equipe)
  const lastByTeam = new Map<string, (typeof evals)[number]>();
  for (const e of evals) {
    const cur = lastByTeam.get(e.team_id);
    if (!cur || sessionDate.get(cur.session_id)! < sessionDate.get(e.session_id)!) lastByTeam.set(e.team_id, e);
  }
  const attention: AttentionTeam[] = [];
  for (const [teamId, e] of lastByTeam) {
    const flagged = e.student_evaluations
      .filter((se) => se.followup_status === "precisa_atencao" || se.followup_status === "necessita_intervencao")
      .filter((se) => !filters.situation || se.followup_status === filters.situation)
      .map((se) => ({ name: se.student?.full_name ?? "", status: se.followup_status as FollowupStatus }));
    const avg = average(e.evaluation_scores.map((s) => s.score));
    const previousUnresolved = e.previous_difficulties_status === "nao_resolvidas";
    if (flagged.length || previousUnresolved || (avg !== null && avg < 2.5) || (filters.situation && flagged.length)) {
      if (filters.situation && !flagged.length) continue;
      attention.push({
        teamId,
        teamName: teamName.get(teamId) ?? "",
        challengeId: e.challenge_id,
        challengeName: challengeName.get(e.challenge_id) ?? "",
        lastDate: sessionDate.get(e.session_id)!,
        average: avg,
        flagged,
        difficulties: e.difficulties,
        previousUnresolved,
      });
    }
  }
  attention.sort((a, b) => b.flagged.length - a.flagged.length || (a.average ?? 9) - (b.average ?? 9));

  // ---- entregas
  const deliverables = deliverablesRes.data ?? [];
  const delivByTeam = new Map<string, Record<DeliverableStatus, number>>();
  for (const d of deliverables) {
    const cur = delivByTeam.get(d.team_id) ?? { nao_iniciada: 0, em_andamento: 0, concluida: 0, bloqueada: 0 };
    cur[d.status]++;
    delivByTeam.set(d.team_id, cur);
  }
  const deliverableProgress = teams
    .map((t) => {
      const c = delivByTeam.get(t.id) ?? { nao_iniciada: 0, em_andamento: 0, concluida: 0, bloqueada: 0 };
      const total = c.nao_iniciada + c.em_andamento + c.concluida + c.bloqueada;
      return { teamId: t.id, team: t.name, ...c, total, pct: total ? Math.round((c.concluida / total) * 100) : 0 };
    })
    .sort((a, b) => a.team.localeCompare(b.team, "pt-BR", { numeric: true }));
  const overdue = deliverables.filter((d) => d.status !== "concluida" && d.due_date && d.due_date < today).length;

  // ---- última sessão (pendências)
  const lastSession = [...sessions].reverse().find(Boolean);
  const lastSessionPending = lastSession
    ? teams
        .filter((t) => t.challenge_id === lastSession.challenge_id)
        .filter((t) => !evals.some((e) => e.session_id === lastSession.id && e.team_id === t.id && e.status === "concluida")).length
    : 0;

  return {
    challenges: challengeList,
    activeChallenges: challengeList.filter((c) => c.status === "ativo").length,
    teamCount: teams.length,
    studentCount,
    expected,
    done,
    drafts,
    pending: Math.max(0, expected - done),
    evolution,
    situation,
    notEvaluatedStudents,
    attention,
    deliverableProgress,
    overdue,
    lastSession: lastSession ? { ...lastSession, pending: lastSessionPending } : null,
  };
}

function round(v: number | null) {
  return v === null ? null : Math.round(v * 100) / 100;
}

function emptyDashboard(challenges: { id: string; name: string; status: string; start_date: string; end_date: string }[]) {
  return {
    challenges,
    activeChallenges: challenges.filter((c) => c.status === "ativo").length,
    teamCount: 0,
    studentCount: 0,
    expected: 0,
    done: 0,
    drafts: 0,
    pending: 0,
    evolution: [] as { date: string; equipes: number | null; alunos: number | null; concluidas: number }[],
    situation: { evoluindo_bem: 0, precisa_atencao: 0, necessita_intervencao: 0, sem_situacao: 0 },
    notEvaluatedStudents: 0,
    attention: [] as AttentionTeam[],
    deliverableProgress: [] as {
      teamId: string;
      team: string;
      nao_iniciada: number;
      em_andamento: number;
      concluida: number;
      bloqueada: number;
      total: number;
      pct: number;
    }[],
    overdue: 0,
    lastSession: null as null | { id: string; challenge_id: string; session_date: string; pending: number },
  };
}

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
