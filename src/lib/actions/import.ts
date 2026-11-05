"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireViewer, canManageChallenge } from "@/lib/auth";
import { parseWorkbook, type ParsedSheet } from "@/lib/import/parse-xlsx";
import { isoDate, uuid } from "@/lib/validation";
import { dbError, fail, ok, type ActionResult } from "./result";

const MAX_SIZE = 8 * 1024 * 1024;

export async function parseSpreadsheet(challengeId: string, formData: FormData): Promise<ActionResult<ParsedSheet[]>> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão para importar neste desafio.");

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Selecione um arquivo.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return fail("Formato não suportado. Envie um arquivo .xlsx.");
  if (file.size > MAX_SIZE) return fail("Arquivo muito grande (máximo 8 MB).");

  try {
    const sheets = await parseWorkbook(await file.arrayBuffer());
    if (!sheets.length) return fail("A planilha não possui abas com dados.");
    return ok(sheets);
  } catch (e) {
    console.error("parseSpreadsheet", e);
    return fail("Não foi possível ler o arquivo. Verifique se é uma planilha .xlsx válida.");
  }
}

export type ImportCandidate = {
  student_id: string;
  registration: string | null;
  full_name: string;
  email: string | null;
  current_team_id: string | null;
  current_team_name: string | null;
};

export async function findCandidates(
  challengeId: string,
  input: { registrations: string[]; emails: string[]; names: string[] },
): Promise<ActionResult<ImportCandidate[]>> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_import_candidates", {
    p_challenge_id: challengeId,
    p_registrations: input.registrations.slice(0, 5000),
    p_emails: input.emails.slice(0, 5000),
    p_names: input.names.slice(0, 5000),
  });
  if (error) return fail(dbError(error));
  return ok(data ?? []);
}

const rowSchema = z.object({
  team_name: z.string().trim().min(1).max(100),
  full_name: z.string().trim().min(1).max(200),
  registration: z.string().trim().max(60).optional(),
  email: z.string().trim().max(200).optional(),
  existing_student_id: uuid.optional(),
});

export type ImportSummary = {
  teams_created: number;
  students_created: number;
  students_linked: number;
  memberships_created: number;
  transfers: number;
  unchanged: number;
};

export async function importRoster(
  challengeId: string,
  rows: z.infer<typeof rowSchema>[],
  startDate: string,
): Promise<ActionResult<ImportSummary>> {
  const viewer = await requireViewer();
  if (!canManageChallenge(viewer, challengeId)) return fail("Sem permissão para importar neste desafio.");
  const parsed = z.array(rowSchema).min(1, "Nenhum registro para importar.").max(5000).safeParse(rows);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Registros inválidos.");
  if (!isoDate.safeParse(startDate).success) return fail("Data de início inválida.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_roster", {
    p_challenge_id: challengeId,
    p_rows: parsed.data,
    p_start_date: startDate,
  });
  if (error) return fail(dbError(error));
  revalidatePath(`/desafios/${challengeId}`, "layout");
  return ok(data as ImportSummary, "Importação concluída.");
}
