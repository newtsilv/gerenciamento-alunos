import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export async function listChallenges() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("id, name, company, status, start_date, end_date, monitoring_weekdays, teams(count), challenge_members(role, profiles(full_name))")
    .order("status")
    .order("start_date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export const getChallenge = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challenges")
    .select("*, challenge_members(id, role, user_id, profiles(id, full_name, email, login, active))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export type ChallengeDetail = NonNullable<Awaited<ReturnType<typeof getChallenge>>>;

export function membersByRole(challenge: ChallengeDetail, role: "coordenador" | "professor" | "monitor") {
  return challenge.challenge_members
    .filter((m) => m.role === role && m.profiles)
    .map((m) => ({ memberId: m.id, id: m.user_id, name: m.profiles!.full_name || m.profiles!.email, email: m.profiles!.login ? `RA ${m.profiles!.login}` : m.profiles!.email }));
}

export async function listTeams(challengeId: string, opts: { includeInactive?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("teams")
    .select("id, name, project_title, description, active, assigned_monitor_id, monitor:profiles!teams_assigned_monitor_id_fkey(full_name), team_memberships(id, end_date)")
    .eq("challenge_id", challengeId)
    .order("name");
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data.map((t) => ({
    ...t,
    memberCount: t.team_memberships.filter((m) => m.end_date === null).length,
  }));
}

export async function listSessions(challengeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monitoring_sessions")
    .select("id, session_date, status, is_extra, team_evaluations(id, status, team_id)")
    .eq("challenge_id", challengeId)
    .order("session_date");
  if (error) throw new Error(error.message);
  return data;
}

export async function listCriteria(challengeId: string, opts: { includeInactive?: boolean } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("evaluation_criteria")
    .select("id, scope, name, description, position, version, is_active, previous_version_id")
    .eq("challenge_id", challengeId)
    .order("position")
    .order("version");
  if (!opts.includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function listTeamsWithMembers(challengeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, project_title, description, active, assigned_monitor_id, team_memberships(id, start_date, end_date, student:students(id, full_name, registration, email))",
    )
    .eq("challenge_id", challengeId)
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((t) => ({
    ...t,
    members: t.team_memberships
      .filter((m) => m.end_date === null && m.student)
      .map((m) => ({ membershipId: m.id, startDate: m.start_date, ...m.student! }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")),
  }));
}
