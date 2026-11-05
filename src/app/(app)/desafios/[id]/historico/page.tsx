import Link from "next/link";
import { notFound } from "next/navigation";
import { HistoryIcon } from "lucide-react";
import { DashboardFilters } from "@/components/dashboard/filters";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireChallengeAccess } from "@/lib/auth";
import { getChallenge, listTeams, membersByRole } from "@/lib/data/challenges";
import { createClient } from "@/lib/supabase/server";
import { EVALUATION_STATUS, FOLLOWUP_STATUS, FOLLOWUP_TONE, PREVIOUS_DIFFICULTY_STATUS, type FollowupStatus } from "@/lib/domain/constants";
import { formatDate, isISODate } from "@/lib/domain/dates";
import { average, formatAverage } from "@/lib/domain/scores";

const str = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function HistoryPage({ params, searchParams }: PageProps<"/desafios/[id]/historico">) {
  const { id } = await params;
  const sp = await searchParams;
  await requireChallengeAccess(id);
  const [challenge, teams] = await Promise.all([getChallenge(id), listTeams(id, { includeInactive: true })]);
  if (!challenge) notFound();

  const supabase = await createClient();
  let q = supabase
    .from("team_evaluations")
    .select(
      "id, status, team_id, monitor_id, difficulties, next_steps, previous_difficulties_status, team:teams(name), session:monitoring_sessions!inner(id, session_date), monitor:profiles!team_evaluations_monitor_id_fkey(full_name), evaluation_scores(score), student_evaluations(student_id, followup_status, student:students(full_name))",
    )
    .eq("challenge_id", id)
    .order("session(session_date)", { ascending: false })
    .limit(300);
  const teamId = str(sp.equipe);
  const monitorId = str(sp.monitor);
  if (teamId) q = q.eq("team_id", teamId);
  if (monitorId) q = q.eq("monitor_id", monitorId);
  if (isISODate(sp.de)) q = q.gte("session.session_date", sp.de);
  if (isISODate(sp.ate)) q = q.lte("session.session_date", sp.ate);
  const { data } = await q;
  const situation = str(sp.situacao) as FollowupStatus | undefined;
  const rows = (data ?? []).filter((e) => !situation || e.student_evaluations.some((s) => s.followup_status === situation));

  return (
    <div>
      <DashboardFilters
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        monitors={membersByRole(challenge, "monitor").map((m) => ({ id: m.id, name: m.name }))}
      />
      {rows.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Nenhum acompanhamento encontrado" description="Ajuste os filtros ou registre acompanhamentos nas sessões." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 font-normal">Data</th>
                <th className="px-4 py-3 font-normal">Equipe</th>
                <th className="px-4 py-3 font-normal">Monitor</th>
                <th className="px-4 py-3 font-normal">Média</th>
                <th className="px-4 py-3 font-normal">Dificuldades / próximos passos</th>
                <th className="px-4 py-3 font-normal">Alunos sinalizados</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((e, i) => {
                const flagged = e.student_evaluations.filter((s) => s.followup_status && s.followup_status !== "evoluindo_bem");
                return (
                  <tr key={e.id} className="align-top transition-colors odd:bg-surface/50 hover:bg-brand-soft/50 animate-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/desafios/${id}/acompanhamentos/${e.session.id}/${e.team_id}`} className="font-medium text-brand hover:underline">
                        {formatDate(e.session.session_date)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.team?.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.monitor?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{formatAverage(average(e.evaluation_scores.map((s) => s.score)))}</td>
                    <td className="max-w-md px-4 py-3">
                      {e.difficulties && <p className="line-clamp-2">{e.difficulties}</p>}
                      {e.next_steps && <p className="line-clamp-1 text-xs text-muted-foreground">→ {e.next_steps}</p>}
                      {e.previous_difficulties_status && (
                        <p className="text-xs text-muted-foreground">Anteriores: {PREVIOUS_DIFFICULTY_STATUS[e.previous_difficulties_status]}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {flagged.map((f) => (
                          <StatusBadge key={f.student_id} tone={FOLLOWUP_TONE[f.followup_status!]} className="max-w-56 truncate" >
                            {f.student?.full_name}
                          </StatusBadge>
                        ))}
                        {!flagged.length && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={e.status === "concluida" ? "success" : "warning"}>{EVALUATION_STATUS[e.status]}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Legenda: <span className="text-warning">{FOLLOWUP_STATUS.precisa_atencao}</span> ·{" "}
        <span className="text-danger">{FOLLOWUP_STATUS.necessita_intervencao}</span>
      </p>
    </div>
  );
}
