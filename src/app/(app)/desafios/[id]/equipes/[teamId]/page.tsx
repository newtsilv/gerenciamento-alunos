import { Stagger, StaggerItem } from "@/components/shared/motion";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Panel } from "@/components/dashboard/widgets";
import { StatusBadge } from "@/components/shared/status-badge";
import { NotesPanel } from "@/components/teams/notes-panel";
import { requireChallengeAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EVALUATION_STATUS, FOLLOWUP_STATUS, FOLLOWUP_TONE } from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/dates";
import { average, formatAverage } from "@/lib/domain/scores";

export default async function TeamDetailPage({ params }: PageProps<"/desafios/[id]/equipes/[teamId]">) {
  const { id, teamId } = await params;
  const access = await requireChallengeAccess(id);
  const supabase = await createClient();

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, project_title, description, active, monitor:profiles!teams_assigned_monitor_id_fkey(full_name)")
    .eq("id", teamId)
    .eq("challenge_id", id)
    .maybeSingle();
  if (!team) notFound();

  const [membershipsRes, evalsRes, notesRes] = await Promise.all([
    supabase
      .from("team_memberships")
      .select("id, start_date, end_date, end_reason, student:students(id, full_name, registration)")
      .eq("team_id", teamId)
      .order("start_date", { ascending: false }),
    supabase
      .from("team_evaluations")
      .select(
        "id, status, difficulties, next_steps, session:monitoring_sessions!inner(id, session_date), monitor:profiles!team_evaluations_monitor_id_fkey(full_name), evaluation_scores(score), student_evaluations(student_id, followup_status, student:students(full_name))",
      )
      .eq("team_id", teamId)
      .order("session(session_date)", { ascending: false }),
    supabase
      .from("pedagogical_notes")
      .select("id, content, created_at, author_id, author:profiles(full_name), student:students(full_name)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false }),
  ]);

  const memberships = membershipsRes.data ?? [];
  const current = memberships.filter((m) => m.end_date === null && m.student);
  const past = memberships.filter((m) => m.end_date !== null && m.student);

  return (
    <Stagger className="flex flex-col gap-6">
      <StaggerItem>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{team.name}</h2>
          {!team.active && <StatusBadge>Desativada</StatusBadge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {team.project_title || "Sem título de projeto"} · Monitor: {team.monitor?.full_name ?? "—"}
        </p>
      </StaggerItem>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-6">
          <Panel title={`Integrantes (${current.length})`}>
            <ul className="divide-y">
              {current.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 py-2 text-sm">
                  <span>{m.student!.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.student!.registration ?? "—"} · desde {formatDate(m.start_date)}
                  </span>
                </li>
              ))}
              {!current.length && <li className="py-4 text-center text-sm text-muted-foreground">Sem integrantes.</li>}
            </ul>
            {past.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground">Histórico de participação ({past.length})</summary>
                <ul className="mt-2 divide-y text-sm">
                  {past.map((m) => (
                    <li key={m.id} className="py-2">
                      <p>{m.student!.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(m.start_date)} – {formatDate(m.end_date)} · {m.end_reason ?? "Encerrado"}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel title="Histórico de acompanhamentos">
            {(evalsRes.data ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum acompanhamento registrado.</p>
            ) : (
              <ul className="divide-y">
                {(evalsRes.data ?? []).map((e) => {
                  const flagged = e.student_evaluations.filter((s) => s.followup_status && s.followup_status !== "evoluindo_bem");
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/desafios/${id}/acompanhamentos/${e.session.id}/${teamId}`}
                        className="group flex flex-col gap-1.5 py-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium group-hover:text-brand">{formatDate(e.session.session_date)}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <StatusBadge tone={e.status === "concluida" ? "success" : "warning"}>{EVALUATION_STATUS[e.status]}</StatusBadge>
                            Média {formatAverage(average(e.evaluation_scores.map((s) => s.score)))}
                            <ChevronRightIcon className="size-4" />
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Monitor: {e.monitor?.full_name ?? "—"}</p>
                        {e.difficulties && <p className="line-clamp-2 text-sm">Dificuldades: {e.difficulties}</p>}
                        {e.next_steps && <p className="line-clamp-2 text-sm text-muted-foreground">Próximos passos: {e.next_steps}</p>}
                        {flagged.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {flagged.map((f) => (
                              <StatusBadge key={f.student_id} tone={FOLLOWUP_TONE[f.followup_status!]}>
                                {f.student?.full_name} · {FOLLOWUP_STATUS[f.followup_status!]}
                              </StatusBadge>
                            ))}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          <Panel title="Observações pedagógicas">
            <NotesPanel
              challengeId={id}
              teamId={teamId}
              viewerId={access.viewer.id}
              students={current.map((m) => ({ id: m.student!.id, name: m.student!.full_name }))}
              notes={(notesRes.data ?? []).map((n) => ({
                id: n.id,
                content: n.content,
                created_at: n.created_at,
                author_id: n.author_id,
                authorName: n.author?.full_name ?? "—",
                studentName: n.student?.full_name ?? null,
              }))}
            />
          </Panel>
        </div>
      </div>
    </Stagger>
  );
}
