import type { FollowupStatus, PreviousDifficultyStatus } from "@/lib/domain/constants";
import type { Score } from "./score-input";

export type Criterion = { id: string; name: string; description: string; is_active: boolean; version: number };
export type ScoreMap = Record<string, number | null>;
export type StudentState = {
  absent: boolean;
  followup_status: FollowupStatus | null;
  notes: string;
  difficulty: string;
  guidance: string;
  scores: ScoreMap;
};
export type FormState = {
  developed: string;
  difficulties: string;
  deliveries_completed: string;
  next_steps: string;
  general_notes: string;
  previous_difficulties_status: PreviousDifficultyStatus | null;
  previous_followup_notes: string;
  team_scores: ScoreMap;
  students: Record<string, StudentState>;
};
export type PreviousEvaluation = {
  date: string;
  monitorName: string | null;
  teamAverage: number | null;
  difficulties: string;
  nextSteps: string;
  developed: string;
  students: Record<string, { followup_status: FollowupStatus | null; difficulty: string; average: number | null }>;
};

export const TEXT_FIELDS = [
  ["developed", "O que a equipe desenvolveu?"],
  ["difficulties", "Quais dificuldades foram encontradas?"],
  ["deliveries_completed", "Quais entregas foram concluídas?"],
  ["next_steps", "O que precisa ser feito até o próximo acompanhamento?"],
  ["general_notes", "Observações gerais"],
] as const;

export function emptyStudent(): StudentState {
  return { absent: false, followup_status: null, notes: "", difficulty: "", guidance: "", scores: {} };
}

export function studentHasContent(s: StudentState) {
  return s.absent || !!s.followup_status || !!s.notes.trim() || !!s.difficulty.trim() || !!s.guidance.trim() || Object.keys(s.scores).length > 0;
}

export function toScore(map: ScoreMap, id: string): Score {
  return id in map ? map[id] : undefined;
}

export function setScore(map: ScoreMap, id: string, v: Score): ScoreMap {
  const next = { ...map };
  if (v === undefined) delete next[id];
  else next[id] = v;
  return next;
}
