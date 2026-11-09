"use client";

import { useState, type ReactNode } from "react";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, Loader2Icon, LockIcon } from "lucide-react";
import { AnimatePresence, m, useReducedMotion, type Variants } from "motion/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BackLink } from "@/components/shared/back-link";
import { Collapse, EASE_OUT } from "@/components/shared/motion";
import { FOLLOWUP_STATUS, FOLLOWUP_TONE, type FollowupStatus } from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/dates";
import { average, formatAverage, isLowAverage } from "@/lib/domain/scores";
import { cn } from "@/lib/utils";
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
import { ScoreSegment } from "./score-input";
import { StudentQuestions } from "./student-questions";

type Step = "equipe" | "alunos" | "registro";
const STEP_ORDER: Step[] = ["equipe", "registro", "alunos"];

/** Troca de passo: o conteúdo desliza no sentido em que a pessoa avançou. */
const stepVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 14 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -14, transition: { duration: 0.1, ease: "easeIn" } }),
};

const toneText = { success: "text-success", warning: "text-warning", danger: "text-danger" } as const;
const toneSelected = {
  success: "border-success/40 bg-success-soft font-medium text-success",
  warning: "border-warning/40 bg-warning-soft font-medium text-warning",
  danger: "border-danger/40 bg-danger-soft font-medium text-danger",
} as const;

/** Registro de acompanhamento no celular: três passos curtos, um aluno aberto por vez e uma única ação principal. */
export function EvaluationMobile({
  challengeId,
  sessionId,
  sessionDate,
  teamName,
  students,
  teamCriteria,
  studentCriteria,
  previous,
  state,
  status,
  canEdit,
  lockedReason,
  saving,
  dirty,
  patch,
  patchStudent,
  onSaveDraft,
  onAutoSave,
  restoreBanner,
  joinedNotice,
  previousBody,
  concludeButton,
}: {
  challengeId: string;
  sessionId: string;
  sessionDate: string;
  teamName: string;
  students: { id: string; full_name: string; registration: string | null }[];
  teamCriteria: Criterion[];
  studentCriteria: Criterion[];
  previous: PreviousEvaluation | null;
  state: FormState;
  status: "rascunho" | "concluida" | null;
  canEdit: boolean;
  lockedReason?: string;
  saving: boolean;
  dirty: boolean;
  patch: (p: Partial<FormState>) => void;
  patchStudent: (id: string, p: Partial<StudentState>) => void;
  onSaveDraft: () => void;
  onAutoSave: () => void;
  restoreBanner: ReactNode;
  joinedNotice: ReactNode;
  previousBody: ReactNode;
  concludeButton: ReactNode;
}) {
  const studentOf = (id: string) => state.students[id] ?? emptyStudent();
  const [step, setStep] = useState<Step>("equipe");
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(
    () => (students.find((st) => !studentHasContent(state.students[st.id] ?? emptyStudent())) ?? students[0])?.id ?? null,
  );
  const [showPrev, setShowPrev] = useState(false);

  // inputs não travam durante o salvamento: travar um campo em foco fecharia o teclado do celular
  const disabled = !canEdit;
  const canDraft = canEdit && status !== "concluida";
  const teamFilled = teamCriteria.filter((c) => c.id in state.team_scores).length;
  const evaluated = students.filter((st) => studentHasContent(studentOf(st.id))).length;

  const autoSave = () => {
    if (canDraft && dirty && !saving) onAutoSave();
  };
  const goStep = (next: Step) => {
    autoSave();
    setDirection(STEP_ORDER.indexOf(next) >= STEP_ORDER.indexOf(step) ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const openStudent = (id: string | null) => {
    setOpenId(id);
    // espera o aluno anterior terminar de fechar, senão a posição final muda durante a rolagem
    if (id) setTimeout(() => document.getElementById(`aluno-${id}`)?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }), 280);
  };

  const openIndex = students.findIndex((st) => st.id === openId);
  const nextStudent = openIndex >= 0 ? students[openIndex + 1] : undefined;
  const steps: { key: Step; label: string; progress?: [number, number] }[] = [
    { key: "equipe", label: "Equipe", progress: [teamFilled, teamCriteria.length] },
    { key: "registro", label: "Registro" },
    { key: "alunos", label: "Alunos", progress: [evaluated, students.length] },
  ];

  const primary =
    step === "equipe" ? (
      <PrimaryButton label="Ir para o registro" onClick={() => goStep("registro")} />
    ) : step === "registro" ? (
      <PrimaryButton label="Avaliar alunos" onClick={() => goStep("alunos")} />
    ) : nextStudent ? (
      <PrimaryButton
        label="Próximo aluno"
        onClick={() => {
          autoSave();
          openStudent(nextStudent.id);
        }}
      />
    ) : canEdit ? (
      concludeButton
    ) : null;

  return (
    <div className="flex flex-col gap-4 pb-6 md:hidden">
      <header data-sticky-top className="sticky top-0 z-30 -mx-4 -mt-6 border-b bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-1 pr-4 pl-1">
          <BackLink
            fallback={`/desafios/${challengeId}/acompanhamentos/${sessionId}`}
            iconOnly
            className="size-10 shrink-0 justify-center"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate leading-tight font-semibold">{teamName}</h2>
            <p className="truncate text-xs text-muted-foreground">
              <span className="capitalize">{formatDate(sessionDate, "EEEE, dd/MM")}</span>
              {status === "concluida" && " · Concluído"}
            </p>
          </div>
          {saving ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" /> Salvando
            </span>
          ) : dirty && canDraft ? (
            <button type="button" onClick={onSaveDraft} className="h-9 rounded-lg px-2 text-sm font-medium text-brand">
              Salvar
            </button>
          ) : dirty ? (
            <span className="text-xs text-warning">Não salvo</span>
          ) : status ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckIcon className="size-3.5" /> Salvo
            </span>
          ) : null}
        </div>
        <nav aria-label="Passos do acompanhamento" className="grid grid-cols-3">
          {steps.map((s) => {
            const active = s.key === step;
            const complete = s.progress && s.progress[1] > 0 && s.progress[0] === s.progress[1];
            return (
              <button
                key={s.key}
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => goStep(s.key)}
                className={cn(
                  "relative flex h-11 items-center justify-center gap-1.5 text-sm transition-colors",
                  active ? "font-medium text-brand" : "text-muted-foreground",
                )}
              >
                {s.label}
                {s.progress &&
                  (complete ? (
                    <CheckIcon className="size-3.5 text-success" aria-label="completo" />
                  ) : (
                    <span className="text-xs font-normal tabular-nums">
                      {s.progress[0]}/{s.progress[1]}
                    </span>
                  ))}
                {active && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-brand" />}
              </button>
            );
          })}
        </nav>
      </header>

      {!canEdit && (
        <div className="flex items-start gap-2 rounded-xl border bg-surface px-3 py-2.5 text-sm text-muted-foreground">
          <LockIcon className="mt-0.5 size-4 shrink-0" />
          {lockedReason ?? "Visualização somente leitura."}
        </div>
      )}
      {restoreBanner}

      <AnimatePresence mode="wait" custom={direction}>
      <m.div key={step} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-4">
      {step === "equipe" && (
        <>
          {previous && (
            <section className="rounded-2xl border bg-card">
              <button
                type="button"
                onClick={() => setShowPrev((v) => !v)}
                aria-expanded={showPrev}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm"
              >
                <span>
                  <span className="font-medium">Último acompanhamento</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(previous.date, "dd/MM")} · média {formatAverage(previous.teamAverage)}
                  </span>
                </span>
                <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", showPrev && "rotate-180")} />
              </button>
              <Collapse open={showPrev}>{previousBody}</Collapse>
            </section>
          )}
          <ul className="flex flex-col gap-5">
            {teamCriteria.map((c) => (
              <li key={c.id}>
                <p className="mb-2 text-sm font-medium">
                  {c.name}
                  {!c.is_active && <span className="ml-2 text-xs font-normal text-muted-foreground">(desativada)</span>}
                </p>
                <ScoreSegment
                  fluid
                  label={c.name}
                  value={toScore(state.team_scores, c.id)}
                  disabled={disabled}
                  onChange={(v) => patch({ team_scores: setScore(state.team_scores, c.id, v) })}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {step === "alunos" && (
        <>
          {joinedNotice && <div className="overflow-hidden rounded-2xl border">{joinedNotice}</div>}
          {students.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum aluno estava nesta equipe neste dia.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {students.map((st) => {
                const s = studentOf(st.id);
                const open = st.id === openId;
                const avg = average(studentCriteria.map((c) => toScore(s.scores, c.id)));
                const filled = studentCriteria.filter((c) => c.id in s.scores).length;
                const prev = previous?.students[st.id];
                return (
                  <li key={st.id} id={`aluno-${st.id}`} className="scroll-mt-28 rounded-2xl border bg-card">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => openStudent(open ? null : st.id)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug font-medium">{st.full_name}</span>
                        <StudentSummary s={s} filled={filled} total={studentCriteria.length} />
                      </span>
                      {!s.absent && avg !== null && (
                        <span className={cn("text-sm font-semibold tabular-nums", isLowAverage(avg) && "text-danger")}>{formatAverage(avg)}</span>
                      )}
                      <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </button>

                    <Collapse open={open}>
                      <div className="flex flex-col gap-4 border-t p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 text-xs text-muted-foreground">
                            {prev?.followup_status ? (
                              <>
                                Antes: <span className={toneText[FOLLOWUP_TONE[prev.followup_status]]}>{FOLLOWUP_STATUS[prev.followup_status]}</span>
                              </>
                            ) : (
                              (st.registration ?? "Sem matrícula")
                            )}
                          </p>
                          <button
                            type="button"
                            aria-pressed={s.absent}
                            disabled={disabled}
                            onClick={() => patchStudent(st.id, { absent: !s.absent })}
                            className={cn(
                              "h-9 shrink-0 rounded-lg border px-3 text-sm transition-colors disabled:opacity-60",
                              s.absent ? "border-foreground/60 bg-foreground/80 font-medium text-background" : "text-muted-foreground",
                            )}
                          >
                            Ausente
                          </button>
                        </div>

                        <Collapse open={!s.absent}>
                          <div className="flex flex-col gap-4">
                            <StudentQuestions s={s} disabled={disabled} prevDifficulty={prev?.difficulty} onChange={(p) => patchStudent(st.id, p)} />
                            {studentCriteria.map((c) => (
                              <div key={c.id}>
                                <p className="text-sm font-medium">
                                  {c.name}
                                  {!c.is_active && <span className="ml-2 text-xs font-normal text-muted-foreground">(desativada)</span>}
                                </p>
                                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                                <div className="mt-2">
                                  <ScoreSegment
                                    fluid
                                    label={`${c.name} — ${st.full_name}`}
                                    value={toScore(s.scores, c.id)}
                                    disabled={disabled}
                                    onChange={(v) => patchStudent(st.id, { scores: setScore(s.scores, c.id, v) })}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </Collapse>

                        <div>
                          <p className="mb-2 text-sm font-medium">Situação</p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(Object.keys(FOLLOWUP_STATUS) as FollowupStatus[]).map((k) => {
                              const selected = s.followup_status === k;
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  aria-pressed={selected}
                                  disabled={disabled}
                                  onClick={() => patchStudent(st.id, { followup_status: selected ? null : k })}
                                  className={cn(
                                    "min-h-12 rounded-lg border px-1.5 py-1 text-xs leading-tight transition-colors disabled:opacity-60",
                                    selected && toneSelected[FOLLOWUP_TONE[k]],
                                  )}
                                >
                                  {FOLLOWUP_STATUS[k]}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    </Collapse>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {step === "registro" && (
        <>
          <div className="flex flex-col gap-4">
            {TEXT_FIELDS.map(([key, label]) => (
              <label key={key} className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">{label}</span>
                <Textarea
                  rows={2}
                  value={state[key]}
                  disabled={disabled}
                  onChange={(e) => patch({ [key]: e.target.value } as Partial<FormState>)}
                />
              </label>
            ))}
          </div>
        </>
      )}
      </m.div>
      </AnimatePresence>

      {primary && (
        <div className="hide-on-keyboard fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          {primary}
        </div>
      )}
    </div>
  );
}

function PrimaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button onClick={onClick} className="h-11 w-full">
      {label} <ArrowRightIcon />
    </Button>
  );
}

function StudentSummary({ s, filled, total }: { s: StudentState; filled: number; total: number }) {
  if (s.absent) return <span className="block text-xs text-muted-foreground">Ausente</span>;
  if (s.followup_status) {
    return <span className={cn("block text-xs", toneText[FOLLOWUP_TONE[s.followup_status]])}>{FOLLOWUP_STATUS[s.followup_status]}</span>;
  }
  return <span className="block text-xs text-muted-foreground">{filled === 0 ? "Não avaliado" : `${filled} de ${total} notas`}</span>;
}
