import { notFound } from "next/navigation";
import { EvaluationForm, type EvaluationFormProps } from "@/components/evaluation/evaluation-form";
import { requireChallengeAccess } from "@/lib/auth";
import { loadEvaluationContext } from "@/lib/data/evaluation";
import { average } from "@/lib/domain/scores";

export default async function EvaluationPage({ params }: PageProps<"/desafios/[id]/acompanhamentos/[sessionId]/[teamId]">) {
  const { id, sessionId, teamId } = await params;
  const access = await requireChallengeAccess(id);
  const ctx = await loadEvaluationContext(sessionId, teamId);
  if (!ctx || ctx.session.challenge_id !== id) notFound();

  const ev = ctx.evaluation;
  const isOwner = !ev || ev.monitor_id === access.viewer.id;
  const canEdit = access.canEvaluate && (isOwner || access.viewer.isAdmin);
  const lockedReason = !access.canEvaluate
    ? "Apenas monitores do desafio registram acompanhamentos. Você pode consultar as informações."
    : !isOwner
      ? `Esta equipe já está sendo avaliada nesta sessão por ${ev?.monitor?.full_name ?? "outro monitor"}.`
      : undefined;

  const initial: EvaluationFormProps["initial"] = {
    developed: ev?.developed ?? "",
    difficulties: ev?.difficulties ?? "",
    deliveries_completed: ev?.deliveries_completed ?? "",
    next_steps: ev?.next_steps ?? "",
    general_notes: ev?.general_notes ?? "",
    previous_difficulties_status: ev?.previous_difficulties_status ?? null,
    previous_followup_notes: ev?.previous_followup_notes ?? "",
    team_scores: Object.fromEntries((ev?.evaluation_scores ?? []).map((s) => [s.criterion_id, s.score])),
    students: Object.fromEntries(
      (ev?.student_evaluations ?? []).map((se) => [
        se.student_id,
        {
          absent: se.absent,
          followup_status: se.followup_status,
          notes: se.notes,
          difficulty: se.difficulty,
          guidance: se.guidance,
          scores: Object.fromEntries(se.evaluation_scores.map((s) => [s.criterion_id, s.score])),
        },
      ]),
    ),
  };

  const prev = ctx.previous;
  const prevSession = prev && (prev as unknown as { session: { session_date: string } }).session;
  const previous: EvaluationFormProps["previous"] = prev
    ? {
        date: prevSession?.session_date ?? "",
        monitorName: prev.monitor?.full_name ?? null,
        teamAverage: average(prev.evaluation_scores.map((s) => s.score)),
        difficulties: prev.difficulties,
        nextSteps: prev.next_steps,
        developed: prev.developed,
        students: Object.fromEntries(
          prev.student_evaluations.map((se) => [
            se.student_id,
            { followup_status: se.followup_status, difficulty: se.difficulty, average: average(se.evaluation_scores.map((s) => s.score)) },
          ]),
        ),
      }
    : null;

  return (
    <div>
      <EvaluationForm
        challengeId={id}
        sessionId={sessionId}
        sessionDate={ctx.session.session_date}
        team={{ id: ctx.team.id, name: ctx.team.name, project_title: ctx.team.project_title }}
        students={ctx.students.map((s) => ({ id: s.id, full_name: s.full_name, registration: s.registration }))}
        teamCriteria={ctx.teamCriteria}
        studentCriteria={ctx.studentCriteria}
        initial={initial}
        status={ev?.status ?? null}
        updatedAt={ev?.updated_at ?? null}
        monitorName={ev?.monitor?.full_name ?? null}
        canEdit={canEdit}
        lockedReason={lockedReason}
        previous={previous}
        deliverables={ctx.deliverables}
        canUpdateDeliverables={true}
        history={ctx.history}
        joinedLater={ctx.joinedLater}
        canManage={access.canManage}
      />
    </div>
  );
}
