import { notFound } from "next/navigation";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/dashboard/widgets";
import { StatusBadge } from "@/components/shared/status-badge";
import { StudentEditDialog } from "@/components/students/student-edit-dialog";
import { requireViewer, isCoordinatorAnywhere } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FOLLOWUP_STATUS, FOLLOWUP_TONE } from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/dates";
import { average, formatAverage } from "@/lib/domain/scores";

export default async function StudentPage({ params }: PageProps<"/alunos/[studentId]">) {
  const { studentId } = await params;
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: student } = await supabase.from("students").select("id, full_name, registration, email, notes").eq("id", studentId).maybeSingle();
  if (!student) notFound();

  const [{ data: memberships }, { data: evals }] = await Promise.all([
    supabase
      .from("team_memberships")
      .select("id, start_date, end_date, end_reason, team:teams(id, name, challenge_id, challenge:challenges(name))")
      .eq("student_id", studentId)
      .order("start_date", { ascending: false }),
    supabase
      .from("student_evaluations")
      .select(
        "id, absent, followup_status, notes, difficulty, guidance, team:teams(id, name), evaluation_scores(score), team_evaluation:team_evaluations!inner(challenge_id, session:monitoring_sessions!inner(id, session_date), monitor:profiles!team_evaluations_monitor_id_fkey(full_name))",
      )
      .eq("student_id", studentId),
  ]);
  const sorted = (evals ?? []).sort((a, b) => b.team_evaluation.session.session_date.localeCompare(a.team_evaluation.session.session_date));
  const canEdit = viewer.isAdmin || isCoordinatorAnywhere(viewer);

  return (
    <PageContainer>
      <PageHeader
        back={{ href: "/alunos", label: "Alunos" }}
        title={student.full_name}
        description={[student.registration && `Matrícula ${student.registration}`, student.email].filter(Boolean).join(" · ")}
        actions={canEdit ? <StudentEditDialog student={student} /> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <Panel title="Participação em equipes">
          <ul className="divide-y">
            {(memberships ?? []).map((m) => (
              <li key={m.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/desafios/${m.team?.challenge_id}/equipes/${m.team?.id}`} className="font-medium hover:text-brand">
                    {m.team?.name}
                  </Link>
                  {m.end_date === null ? <StatusBadge tone="success">Atual</StatusBadge> : <StatusBadge>Encerrado</StatusBadge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.team?.challenge?.name} · {formatDate(m.start_date)} – {m.end_date ? formatDate(m.end_date) : "atual"}
                  {m.end_reason && ` · ${m.end_reason}`}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Avaliações individuais">
          {!sorted.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma avaliação registrada.</p>
          ) : (
            <ul className="divide-y">
              {sorted.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/desafios/${e.team_evaluation.challenge_id}/acompanhamentos/${e.team_evaluation.session.id}/${e.team?.id}`}
                      className="font-medium hover:text-brand"
                    >
                      {formatDate(e.team_evaluation.session.session_date)} · {e.team?.name}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {e.absent ? "Ausente" : `Média ${formatAverage(average(e.evaluation_scores.map((s) => s.score)))}`}
                      {e.followup_status && <StatusBadge tone={FOLLOWUP_TONE[e.followup_status]}>{FOLLOWUP_STATUS[e.followup_status]}</StatusBadge>}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Monitor: {e.team_evaluation.monitor?.full_name ?? "—"}</p>
                  {e.difficulty && <p>Dificuldade: {e.difficulty}</p>}
                  {e.guidance && <p className="text-muted-foreground">Orientação: {e.guidance}</p>}
                  {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PageContainer>
  );
}
