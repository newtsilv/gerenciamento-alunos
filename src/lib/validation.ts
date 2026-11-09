import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
export const uuid = z.uuid("Identificador inválido");
const trimmed = (max = 500) => z.string().trim().max(max, `Máximo de ${max} caracteres`);

export const challengeSchema = z
  .object({
    name: trimmed(150).min(1, "Informe o nome do desafio"),
    company: trimmed(150),
    description: trimmed(4000),
    start_date: isoDate,
    end_date: isoDate,
    status: z.enum(["planejado", "ativo", "encerrado", "arquivado"]),
    monitoring_weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Selecione ao menos um dia de acompanhamento"),
  })
  .refine((v) => v.end_date >= v.start_date, {
    path: ["end_date"],
    message: "A data de encerramento deve ser posterior ao início",
  });
export type ChallengeInput = z.infer<typeof challengeSchema>;

export const teamSchema = z.object({
  name: trimmed(100).min(1, "Informe o nome da equipe"),
  project_title: trimmed(200),
  description: trimmed(2000),
  assigned_monitor_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
});
export type TeamInput = z.input<typeof teamSchema>;

export const studentSchema = z.object({
  full_name: trimmed(200).min(1, "Informe o nome do aluno"),
  registration: trimmed(60),
  email: z.union([z.email("E-mail inválido"), z.literal("")]),
  notes: trimmed(2000).optional(),
});
export type StudentInput = z.infer<typeof studentSchema>;

export const transferSchema = z.object({
  student_id: uuid,
  to_team_id: uuid,
  date: isoDate,
  reason: trimmed(300),
});
export type TransferInput = z.infer<typeof transferSchema>;

export const userSchema = z.object({
  full_name: trimmed(150).min(1, "Informe o nome"),
  login: trimmed(60).regex(/^[A-Za-z0-9._-]*$/, "Use apenas letras, números, ponto, hífen ou sublinhado"),
  email: z.union([z.email("E-mail inválido"), z.literal("")]),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  is_admin: z.boolean(),
});
export type UserInput = z.infer<typeof userSchema>;
export const userIdentitySchema = userSchema.pick({ full_name: true, login: true });
export type UserIdentityInput = z.infer<typeof userIdentitySchema>;

const score = z.number().int().min(0).max(10).nullable(); // null = "Não observado"

export const evaluationSchema = z.object({
  session_id: uuid,
  team_id: uuid,
  status: z.enum(["rascunho", "concluida"]),
  developed: trimmed(5000),
  difficulties: trimmed(5000),
  deliveries_completed: trimmed(5000),
  next_steps: trimmed(5000),
  general_notes: trimmed(5000),
  previous_difficulties_status: z.enum(["resolvidas", "parcialmente", "nao_resolvidas", "sem_dificuldades"]).nullable(),
  previous_followup_notes: trimmed(5000),
  team_scores: z.array(z.object({ criterion_id: uuid, score })),
  students: z.array(
    z.object({
      student_id: uuid,
      absent: z.boolean(),
      followup_status: z.enum(["evoluindo_bem", "precisa_atencao", "necessita_intervencao"]).nullable(),
      activities: trimmed(3000),
      deliveries: trimmed(3000),
      commitments: trimmed(3000),
      notes: trimmed(3000),
      difficulty: trimmed(3000),
      guidance: trimmed(3000),
      scores: z.array(z.object({ criterion_id: uuid, score })),
    }),
  ),
});
export type EvaluationInput = z.infer<typeof evaluationSchema>;

export function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}
