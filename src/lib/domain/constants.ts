export const CHALLENGE_STATUS = {
  planejado: "Planejado",
  ativo: "Ativo",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
} as const;
export type ChallengeStatus = keyof typeof CHALLENGE_STATUS;

export const CHALLENGE_ROLE = {
  coordenador: "Coordenador",
  professor: "Professor",
  monitor: "Monitor",
} as const;
export type ChallengeRole = keyof typeof CHALLENGE_ROLE;

export const FOLLOWUP_STATUS = {
  evoluindo_bem: "Evoluindo bem",
  precisa_atencao: "Precisa de atenção",
  necessita_intervencao: "Necessita de intervenção",
} as const;
export type FollowupStatus = keyof typeof FOLLOWUP_STATUS;

export const FOLLOWUP_TONE: Record<FollowupStatus, "success" | "warning" | "danger"> = {
  evoluindo_bem: "success",
  precisa_atencao: "warning",
  necessita_intervencao: "danger",
};

export const DELIVERABLE_STATUS = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
} as const;
export type DeliverableStatus = keyof typeof DELIVERABLE_STATUS;

export const DELIVERABLE_TONE: Record<DeliverableStatus, "neutral" | "info" | "success" | "danger"> = {
  nao_iniciada: "neutral",
  em_andamento: "info",
  concluida: "success",
  bloqueada: "danger",
};

export const PREVIOUS_DIFFICULTY_STATUS = {
  resolvidas: "Resolvidas",
  parcialmente: "Parcialmente resolvidas",
  nao_resolvidas: "Não resolvidas",
  sem_dificuldades: "Não havia dificuldades",
} as const;
export type PreviousDifficultyStatus = keyof typeof PREVIOUS_DIFFICULTY_STATUS;

export const EVALUATION_STATUS = {
  rascunho: "Rascunho",
  concluida: "Concluída",
} as const;
export type EvaluationStatus = keyof typeof EVALUATION_STATUS;

/** Estado de uma equipe dentro de uma sessão de acompanhamento */
export type TeamSessionState = "pendente" | "em_andamento" | "concluido";
export const TEAM_SESSION_STATE: Record<TeamSessionState, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export function teamSessionState(status: EvaluationStatus | null | undefined): TeamSessionState {
  if (!status) return "pendente";
  return status === "concluida" ? "concluido" : "em_andamento";
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export const SCORE_VALUES = [1, 2, 3, 4, 5] as const;

export const CHALLENGE_STATUS_TONE: Record<ChallengeStatus, "info" | "success" | "neutral"> = {
  planejado: "info",
  ativo: "success",
  encerrado: "neutral",
  arquivado: "neutral",
};
