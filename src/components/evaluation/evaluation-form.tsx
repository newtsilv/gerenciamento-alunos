"use client";

import { Collapse, Reveal } from "@/components/shared/motion";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CloudIcon,
  HistoryIcon,
  Loader2Icon,
  LockIcon,
  MessageSquareTextIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/shared/native-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { saveEvaluation } from "@/lib/actions/evaluations";
import { setDeliverableStatus } from "@/lib/actions/deliverables";
import { backdateTeamMembers } from "@/lib/actions/teams";
import {
  DELIVERABLE_STATUS,
  DELIVERABLE_TONE,
  FOLLOWUP_STATUS,
  FOLLOWUP_TONE,
  PREVIOUS_DIFFICULTY_STATUS,
  SCORE_VALUES,
  type DeliverableStatus,
  type FollowupStatus,
  type PreviousDifficultyStatus,
} from "@/lib/domain/constants";
import { formatDate, formatDateTime } from "@/lib/domain/dates";
import { average, formatAverage, isLowAverage } from "@/lib/domain/scores";
import type { EvaluationInput } from "@/lib/validation";
import { ScoreSegment, ScoreSelect, type Score } from "./score-input";
import { EvaluationMobile } from "./evaluation-mobile";
import { StudentNotes } from "./student-notes";
import {
  emptyStudent,
  setScore,
  studentHasContent,
  TEXT_FIELDS,
  toScore,
  type Criterion,
  type FormState,
  type PreviousEvaluation,
  type StudentState,
} from "./evaluation-state";

export type EvaluationFormProps = {
  challengeId: string;
  sessionId: string;
  sessionDate: string;
  team: { id: string; name: string; project_title: string };
  students: { id: string; full_name: string; registration: string | null }[];
  teamCriteria: Criterion[];
  studentCriteria: Criterion[];
  initial: FormState;
  status: "rascunho" | "concluida" | null;
  updatedAt: string | null;
  monitorName: string | null;
  canEdit: boolean;
  lockedReason?: string;
  previous: PreviousEvaluation | null;
  deliverables: { id: string; title: string; due_date: string | null; status: DeliverableStatus }[];
  canUpdateDeliverables: boolean;
  history: { changed_at: string; action: string; name: string | null }[];
  /** integrantes que entraram na equipe depois deste dia */
  joinedLater: { count: number; firstDate: string } | null;
  canManage: boolean;
};

export function EvaluationForm(props: EvaluationFormProps) {
  const {
    challengeId,
    sessionId,
    sessionDate,
    team,
    students,
    teamCriteria,
    studentCriteria,
    canEdit,
    previous,
  } = props;
  const router = useRouter();
  const storageKey = `eval:${sessionId}:${team.id}`;

  const [state, setState] = useState<FormState>(() => {
    const s = { ...props.initial, students: { ...props.initial.students } };
    for (const st of students) s.students[st.id] ??= emptyStudent();
    return s;
  });
  const [status, setStatus] = useState(props.status);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(state));
  const [lastSaved, setLastSaved] = useState<string | null>(props.updatedAt);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showPrev, setShowPrev] = useState(true);
  const [restore, setRestore] = useState<FormState | null>(null);
  const [saving, startSaving] = useTransition();
  const [, startDeliverable] = useTransition();
  const [fixing, startFixing] = useTransition();
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshot = useMemo(() => JSON.stringify(state), [state]);
  const dirty = snapshot !== savedSnapshot;

  // ---- backup local (protege contra perda de conexão / fechamento acidental)
  useEffect(() => {
    if (!canEdit) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const backup = JSON.parse(raw) as { at: string; state: FormState };
      const serverTime = props.updatedAt ? new Date(props.updatedAt).getTime() : 0;
      if (new Date(backup.at).getTime() > serverTime && JSON.stringify(backup.state) !== savedSnapshot) {
        // adiado para fora do ciclo do efeito (leitura de sistema externo)
        setTimeout(() => setRestore(backup.state), 0);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      /* ignora backup inválido */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canEdit || !dirty) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ at: new Date().toISOString(), state }));
    } catch {
      /* armazenamento indisponível */
    }
  }, [snapshot, dirty, canEdit, storageKey, state]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const buildPayload = useCallback(
    (targetStatus: "rascunho" | "concluida"): EvaluationInput => ({
      session_id: sessionId,
      team_id: team.id,
      status: targetStatus,
      developed: state.developed,
      difficulties: state.difficulties,
      deliveries_completed: state.deliveries_completed,
      next_steps: state.next_steps,
      general_notes: state.general_notes,
      previous_difficulties_status: state.previous_difficulties_status,
      previous_followup_notes: state.previous_followup_notes,
      team_scores: Object.entries(state.team_scores).map(([criterion_id, score]) => ({ criterion_id, score })),
      students: Object.entries(state.students).map(([student_id, s]) => ({
        student_id,
        absent: s.absent,
        followup_status: s.followup_status,
        notes: s.notes,
        difficulty: s.difficulty,
        guidance: s.guidance,
        scores: s.absent ? [] : Object.entries(s.scores).map(([criterion_id, score]) => ({ criterion_id, score })),
      })),
    }),
    [state, sessionId, team.id],
  );

  const save = useCallback(
    (targetStatus: "rascunho" | "concluida", opts: { silent?: boolean } = {}) =>
      new Promise<boolean>((resolve) => {
        const payloadSnapshot = snapshot;
        startSaving(async () => {
          const r = await saveEvaluation(challengeId, buildPayload(targetStatus));
          if (!r.ok) {
            toast.error(r.error);
            resolve(false);
            return;
          }
          setSavedSnapshot(payloadSnapshot);
          setLastSaved(r.data.savedAt);
          setStatus((s) => (s === "concluida" ? "concluida" : targetStatus));
          try {
            localStorage.removeItem(storageKey);
          } catch {}
          if (!opts.silent) {
            toast.success(r.message);
            router.refresh();
          }
          resolve(true);
        });
      }),
    [snapshot, buildPayload, challengeId, storageKey, router],
  );

  // ---- salvamento automático de rascunho (somente enquanto não concluído)
  useEffect(() => {
    if (!canEdit || !dirty || status === "concluida" || saving) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void save("rascunho", { silent: true }), 20000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [snapshot, dirty, canEdit, status, saving, save]);

  // ---- helpers de atualização
  const patch = (p: Partial<FormState>) => setState((s) => ({ ...s, ...p }));
  const patchStudent = (id: string, p: Partial<StudentState>) =>
    setState((s) => ({ ...s, students: { ...s.students, [id]: { ...s.students[id], ...p } } }));

  const fillColumn = (criterionId: string, v: Score) =>
    setState((s) => {
      const next = { ...s.students };
      for (const st of students) {
        const cur = next[st.id];
        if (!cur || cur.absent) continue;
        next[st.id] = { ...cur, scores: setScore(cur.scores, criterionId, v) };
      }
      return { ...s, students: next };
    });

  const fillRow = (studentId: string, v: Score) =>
    setState((s) => {
      const cur = s.students[studentId];
      let scores = cur.scores;
      for (const c of studentCriteria) scores = setScore(scores, c.id, v);
      return { ...s, students: { ...s.students, [studentId]: { ...cur, scores } } };
    });

  // ---- indicadores
  const teamAvg = average(teamCriteria.map((c) => toScore(state.team_scores, c.id)));
  const teamFilled = teamCriteria.filter((c) => c.id in state.team_scores).length;
  const evaluatedStudents = students.filter((st) => studentHasContent(state.students[st.id] ?? emptyStudent())).length;
  const missingTeamCriteria = teamCriteria.length - teamFilled;
  const pendingStudents = students.length - evaluatedStudents;

  const disabled = !canEdit || saving;

  // ---- blocos usados tanto no desktop quanto no fluxo de celular
  const restoreBanner = restore && (
    <div className="flex flex-col gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-warning">Existem alterações não salvas deste dispositivo para esta avaliação.</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            localStorage.removeItem(storageKey);
            setRestore(null);
          }}
        >
          Descartar
        </Button>
        <Button
          size="sm"
          onClick={() => {
            setState(restore);
            setRestore(null);
          }}
        >
          Restaurar
        </Button>
      </div>
    </div>
  );

  const previousBody = (inputDisabled: boolean) =>
    previous && (
      <div className="grid gap-4 border-t p-4 md:grid-cols-2">
        <PrevBlock title="Dificuldades registradas" text={previous.difficulties} />
        <PrevBlock title="Combinado para este acompanhamento" text={previous.nextSteps} />
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-medium">As dificuldades anteriores foram resolvidas?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PREVIOUS_DIFFICULTY_STATUS) as PreviousDifficultyStatus[]).map((k) => (
              <button
                key={k}
                type="button"
                disabled={inputDisabled}
                aria-pressed={state.previous_difficulties_status === k}
                onClick={() => patch({ previous_difficulties_status: state.previous_difficulties_status === k ? null : k })}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm transition-colors disabled:opacity-60",
                  state.previous_difficulties_status === k ? "border-brand bg-brand-soft font-medium text-brand" : "hover:bg-surface",
                )}
              >
                {PREVIOUS_DIFFICULTY_STATUS[k]}
              </button>
            ))}
          </div>
          <Textarea
            className="mt-2"
            rows={2}
            placeholder="Comentário sobre a evolução das dificuldades anteriores (opcional)"
            value={state.previous_followup_notes}
            disabled={inputDisabled}
            onChange={(e) => patch({ previous_followup_notes: e.target.value })}
          />
        </div>
      </div>
    );

  const deliverablesList = (
    <ul className="flex flex-col gap-2.5">
      {props.deliverables.map((d) => (
        <li key={d.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{d.title}</span>
            {d.due_date && <span className="shrink-0 text-xs text-muted-foreground">{formatDate(d.due_date, "dd/MM")}</span>}
          </div>
          {props.canUpdateDeliverables ? (
            <NativeSelect
              className="h-8"
              defaultValue={d.status}
              aria-label={`Status de ${d.title}`}
              onChange={(e) => {
                const value = e.target.value;
                startDeliverable(async () => {
                  const r = await setDeliverableStatus(challengeId, d.id, value);
                  if (r.ok) toast.success(`${d.title}: ${DELIVERABLE_STATUS[value as DeliverableStatus]}`);
                  else toast.error(r.error);
                });
              }}
            >
              {Object.entries(DELIVERABLE_STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <StatusBadge tone={DELIVERABLE_TONE[d.status]}>{DELIVERABLE_STATUS[d.status]}</StatusBadge>
          )}
        </li>
      ))}
    </ul>
  );

  const historyList = (
    <ul className="flex flex-col gap-2 text-sm">
      {props.history.map((h, i) => (
        <li key={i} className="flex justify-between gap-2">
          <span>{h.action === "INSERT" ? "Criada" : h.action === "UPDATE" ? "Alterada" : "Excluída"} {h.name && `por ${h.name}`}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(h.changed_at)}</span>
        </li>
      ))}
    </ul>
  );

  const joinedNotice = props.joinedLater && (
    <div className="flex flex-col gap-3 border-t bg-warning-soft/60 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-warning">
        {props.joinedLater.count === 1 ? "1 aluno entrou" : `${props.joinedLater.count} alunos entraram`} na equipe em{" "}
        <strong>{formatDate(props.joinedLater.firstDate)}</strong>, depois deste dia, por isso{" "}
        {props.joinedLater.count === 1 ? "não aparece" : "não aparecem"} aqui.
      </p>
      {props.canManage ? (
        <Button
          size="sm"
          variant="outline"
          disabled={fixing}
          onClick={() =>
            startFixing(async () => {
              const r = await backdateTeamMembers(challengeId, team.id);
              if (r.ok) {
                toast.success(r.message);
                // recarrega para trazer os alunos; o que já foi digitado fica no backup local
                window.location.reload();
              } else toast.error(r.error);
            })
          }
        >
          {fixing && <Loader2Icon className="animate-spin" />}
          Já estavam na equipe desde o início
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Peça à coordenação para ajustar a data de entrada.</span>
      )}
    </div>
  );

  const concludeButton = (triggerClassName: string) => (
    <ConfirmDialog
      title={status === "concluida" ? "Salvar correção?" : "Concluir acompanhamento?"}
      description={
        <span className="flex flex-col gap-1">
          {missingTeamCriteria > 0 && (
            <span className="text-warning">{missingTeamCriteria} critério(s) coletivo(s) sem preenchimento.</span>
          )}
          {pendingStudents > 0 && <span className="text-warning">{pendingStudents} aluno(s) sem avaliação individual.</span>}
          {status === "concluida"
            ? "A alteração ficará registrada no histórico da avaliação."
            : "Você ainda poderá corrigir depois; as alterações ficam registradas no histórico."}
        </span>
      }
      confirmLabel={status === "concluida" ? "Salvar correção" : "Concluir"}
      onConfirm={() => save("concluida")}
      trigger={
        <Button disabled={saving || (status === "concluida" && !dirty)} className={triggerClassName}>
          <CheckCircle2Icon /> {status === "concluida" ? "Salvar correção" : "Concluir"}
        </Button>
      }
    />
  );

  return (
    <>
    <EvaluationMobile
      challengeId={challengeId}
      sessionId={sessionId}
      sessionDate={sessionDate}
      teamName={team.name}
      students={students}
      teamCriteria={teamCriteria}
      studentCriteria={studentCriteria}
      previous={previous}
      state={state}
      status={status}
      canEdit={canEdit}
      lockedReason={props.lockedReason}
      saving={saving}
      dirty={dirty}
      patch={patch}
      patchStudent={patchStudent}
      onSaveDraft={() => void save("rascunho")}
      onAutoSave={() => void save("rascunho", { silent: true })}
      restoreBanner={restoreBanner}
      joinedNotice={joinedNotice}
      previousBody={previousBody(!canEdit)}
      deliverables={props.deliverables.length > 0 ? deliverablesList : null}
      history={props.history.length > 0 ? historyList : null}
      concludeButton={concludeButton("h-11 w-full")}
    />
    {/* só esmaece: a barra de ações fixa ficaria fora do lugar com transform no pai */}
    <Reveal distance={0} className="hidden flex-col gap-5 pb-24 md:flex">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{team.name}</h2>
          <p className="text-sm text-muted-foreground">
            {team.project_title && `${team.project_title} · `}Acompanhamento de {formatDate(sessionDate, "dd/MM/yyyy (EEEE)")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === "concluida" ? (
            <StatusBadge tone="success" dot>
              Concluído
            </StatusBadge>
          ) : status === "rascunho" ? (
            <StatusBadge tone="warning" dot>
              Rascunho
            </StatusBadge>
          ) : (
            <StatusBadge dot>Pendente</StatusBadge>
          )}
          {props.monitorName && <span className="text-sm text-muted-foreground">Monitor: {props.monitorName}</span>}
        </div>
      </div>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-xl border bg-surface px-4 py-3 text-sm text-muted-foreground">
          <LockIcon className="mt-0.5 size-4 shrink-0" />
          {props.lockedReason ?? "Visualização somente leitura."}
        </div>
      )}

      {restoreBanner}

      {/* Acompanhamento anterior */}
      {previous && (
        <section className="rounded-2xl border bg-card">
          <button
            type="button"
            onClick={() => setShowPrev((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
            aria-expanded={showPrev}
          >
            <span className="flex items-center gap-2 font-medium">
              <HistoryIcon className="size-4 text-brand" />
              Acompanhamento anterior · {formatDate(previous.date)}
              {previous.monitorName && <span className="font-normal text-muted-foreground">({previous.monitorName})</span>}
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              Média {formatAverage(previous.teamAverage)}
              <ChevronDownIcon className={cn("size-4 transition-transform", showPrev && "rotate-180")} />
            </span>
          </button>
          <Collapse open={showPrev}>{previousBody(disabled)}</Collapse>
        </section>
      )}

      <div className="contents xl:grid xl:grid-cols-[1fr_320px] xl:gap-5">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Avaliação coletiva */}
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Avaliação coletiva</h3>
              <span className="text-sm text-muted-foreground">
                {teamFilled}/{teamCriteria.length} critérios · média <strong className="text-foreground">{formatAverage(teamAvg)}</strong>
              </span>
            </div>
            <ul className="divide-y">
              {teamCriteria.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {c.name}
                      {!c.is_active && <span className="ml-2 text-xs text-muted-foreground">(versão {c.version}, desativada)</span>}
                    </p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </div>
                  <ScoreSegment
                    label={c.name}
                    value={toScore(state.team_scores, c.id)}
                    disabled={disabled}
                    onChange={(v) => patch({ team_scores: setScore(state.team_scores, c.id, v) })}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {TEXT_FIELDS.map(([key, label]) => (
                <label key={key} className={cn("flex flex-col gap-1.5", key === "general_notes" && "md:col-span-2")}>
                  <span className="text-sm font-medium">{label}</span>
                  <Textarea
                    rows={3}
                    value={state[key]}
                    disabled={disabled}
                    onChange={(e) => patch({ [key]: e.target.value } as Partial<FormState>)}
                  />
                </label>
              ))}
            </div>
          </section>

        </div>

        {/* Lateral */}
        <aside className="flex flex-col gap-5 max-xl:order-last">
          <section className="rounded-2xl border bg-card p-4">
            <h3 className="mb-3 font-semibold">Entregas da equipe</h3>
            {props.deliverables.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma entrega cadastrada.</p>
            ) : (
              deliverablesList
            )}
          </section>

          {props.history.length > 0 && (
            <section className="rounded-2xl border bg-card p-4">
              <h3 className="mb-3 font-semibold">Histórico de alterações</h3>
              {historyList}
            </section>
          )}
        </aside>
      </div>

      {/* Avaliação individual */}
      <section className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:px-5">
          <h3 className="font-semibold">Avaliação individual</h3>
          <span className="text-sm text-muted-foreground">
            {evaluatedStudents}/{students.length} alunos avaliados
          </span>
        </div>

        {joinedNotice}
        {students.length === 0 ? (
          <p className="border-t px-5 py-8 text-center text-sm text-muted-foreground">Nenhum aluno estava nesta equipe neste dia.</p>
        ) : (
          <>
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead className="bg-surface text-left">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-48 bg-surface px-4 py-2 font-medium">Aluno</th>
                    {studentCriteria.map((c) => (
                      <th key={c.id} className="min-w-20 px-1.5 py-2 text-center align-bottom font-normal">
                        <span className="block text-xs leading-tight font-medium text-foreground" title={c.description || c.name}>
                          {c.name}
                        </span>
                        {canEdit && (
                          <select
                            aria-label={`Aplicar nota a todos em ${c.name}`}
                            className="mt-1 h-6 w-full rounded border bg-card text-center text-xs text-muted-foreground"
                            value=""
                            disabled={disabled}
                            onChange={(e) => {
                              const v = e.target.value;
                              fillColumn(c.id, v === "clear" ? undefined : v === "no" ? null : Number(v));
                            }}
                          >
                            <option value="">todos…</option>
                            {SCORE_VALUES.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                            <option value="no">N/O</option>
                            <option value="clear">limpar</option>
                          </select>
                        )}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-medium">Média</th>
                    <th className="min-w-44 px-2 py-2 font-medium">Situação</th>
                    <th className="px-2 py-2 text-center font-medium">Ausente</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((st) => {
                    const s = state.students[st.id] ?? emptyStudent();
                    const avg = average(studentCriteria.map((c) => toScore(s.scores, c.id)));
                    const prev = previous?.students[st.id];
                    const open = expanded[st.id];
                    return (
                      <StudentRowGroup key={st.id}>
                        <tr className={cn(s.absent && "bg-surface/60")}>
                          <td className="sticky left-0 z-10 bg-card px-4 py-2">
                            <p className="font-medium">{st.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {st.registration ?? "Sem matrícula"}
                              {prev?.followup_status && (
                                <>
                                  {" · antes: "}
                                  <span className={cn(FOLLOWUP_TONE[prev.followup_status] === "danger" ? "text-danger" : FOLLOWUP_TONE[prev.followup_status] === "warning" ? "text-warning" : "text-success")}>
                                    {FOLLOWUP_STATUS[prev.followup_status]}
                                  </span>
                                </>
                              )}
                            </p>
                          </td>
                          {studentCriteria.map((c) => (
                            <td key={c.id} className="px-1.5 py-2">
                              <ScoreSelect
                                label={`${c.name} — ${st.full_name}`}
                                value={toScore(s.scores, c.id)}
                                disabled={disabled || s.absent}
                                onChange={(v) => patchStudent(st.id, { scores: setScore(s.scores, c.id, v) })}
                              />
                            </td>
                          ))}
                          <td className={cn("px-2 py-2 text-center font-medium tabular-nums", isLowAverage(avg) && "text-danger")}>
                            {formatAverage(avg)}
                          </td>
                          <td className="px-2 py-2">
                            <FollowupSelect
                              value={s.followup_status}
                              disabled={disabled}
                              onChange={(v) => patchStudent(st.id, { followup_status: v })}
                            />
                            {isLowAverage(avg) && !s.followup_status && (
                              <p className="mt-1 text-[11px] text-warning">Média baixa — avalie a situação</p>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--brand)]"
                              aria-label={`${st.full_name} ausente`}
                              checked={s.absent}
                              disabled={disabled}
                              onChange={(e) => patchStudent(st.id, { absent: e.target.checked })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Button
                              variant={open ? "secondary" : "ghost"}
                              size="icon-sm"
                              aria-label={`Observações de ${st.full_name}`}
                              aria-expanded={open}
                              onClick={() => setExpanded((e) => ({ ...e, [st.id]: !open }))}
                              className={cn((s.notes || s.difficulty || s.guidance) && "text-brand")}
                            >
                              <MessageSquareTextIcon />
                            </Button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-surface/40">
                            <td colSpan={studentCriteria.length + 5} className="px-4 py-3">
                              <Collapse open appear>
                                <StudentNotes
                                  s={s}
                                  disabled={disabled}
                                  prevDifficulty={prev?.difficulty}
                                  onChange={(p) => patchStudent(st.id, p)}
                                  onFillRow={canEdit ? (v) => fillRow(st.id, v) : undefined}
                                />
                              </Collapse>
                            </td>
                          </tr>
                        )}
                      </StudentRowGroup>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Barra de ações fixa */}
      {canEdit && (
        <div className="fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-30 rounded-2xl border bg-background/95 shadow-lg backdrop-blur-md lg:inset-x-0 lg:bottom-0 lg:left-64 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:shadow-none">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 lg:px-10 lg:py-3">
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {saving ? (
                <>
                  <Loader2Icon className="size-3.5 animate-spin" /> Salvando…
                </>
              ) : dirty ? (
                <>Alterações não salvas{status !== "concluida" && " · salvamento automático em instantes"}</>
              ) : lastSaved ? (
                <>
                  <CloudIcon className="size-3.5" /> Salvo em {formatDateTime(lastSaved)}
                </>
              ) : (
                "Nenhuma alteração"
              )}
            </span>
            <div className="flex flex-1 justify-end gap-2 sm:flex-none">
              {status !== "concluida" && (
                <Button variant="outline" disabled={saving || !dirty} onClick={() => void save("rascunho")} className="max-sm:flex-1">
                  <SaveIcon /> Salvar rascunho
                </Button>
              )}
              {concludeButton("max-sm:flex-1")}
            </div>
          </div>
        </div>
      )}
    </Reveal>
    </>
  );
}

function StudentRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function PrevBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">{title}</p>
      <p className="text-sm whitespace-pre-wrap">{text?.trim() || <span className="text-muted-foreground">Não registrado.</span>}</p>
    </div>
  );
}

function FollowupSelect({
  value,
  onChange,
  disabled,
}: {
  value: FollowupStatus | null;
  onChange: (v: FollowupStatus | null) => void;
  disabled?: boolean;
}) {
  const tone = value ? FOLLOWUP_TONE[value] : null;
  return (
    <NativeSelect
      aria-label="Situação de acompanhamento"
      className={cn(
        "h-9",
        tone === "success" && "border-success/30 bg-success-soft text-success",
        tone === "warning" && "border-warning/30 bg-warning-soft text-warning",
        tone === "danger" && "border-danger/30 bg-danger-soft text-danger",
      )}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange((e.target.value || null) as FollowupStatus | null)}
    >
      <option value="">Situação…</option>
      {Object.entries(FOLLOWUP_STATUS).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </NativeSelect>
  );
}
