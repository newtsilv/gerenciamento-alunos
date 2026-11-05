/** Lógica pura de mapeamento/validação da importação (usada no cliente e nos testes). */

export const IMPORT_FIELDS = {
  full_name: { label: "Nome do aluno", required: true },
  registration: { label: "Matrícula / RA", required: false },
  email: { label: "E-mail", required: false },
  team_name: { label: "Equipe", required: true },
  challenge: { label: "Desafio", required: false },
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
export type ColumnMapping = Partial<Record<ImportField, number>>;

const HINTS: Record<ImportField, string[]> = {
  full_name: ["nome do aluno", "nome completo", "aluno", "nome", "estudante", "integrante", "name"],
  registration: ["matricula", "matrícula", "ra", "registro", "identificador", "id aluno", "codigo", "código", "cpf"],
  email: ["e-mail", "email", "correio"],
  team_name: ["equipe", "time", "grupo", "squad", "team"],
  challenge: ["desafio", "projeto", "empresa", "challenge"],
};

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sugere o mapeamento a partir dos nomes das colunas. */
export function guessMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  const used = new Set<number>();
  for (const field of Object.keys(HINTS) as ImportField[]) {
    const hints = HINTS[field].map(normalizeHeader);
    let index = normalized.findIndex((h, i) => !used.has(i) && hints.includes(h));
    if (index < 0) index = normalized.findIndex((h, i) => !used.has(i) && hints.some((hint) => hint.length > 2 && h.includes(hint)));
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

export type MappedRow = {
  rowNumber: number;
  full_name: string;
  registration: string;
  email: string;
  team_name: string;
  challenge: string;
  errors: string[];
  warnings: string[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Aplica o mapeamento e valida campos obrigatórios e duplicidades dentro do próprio arquivo. */
export function mapRows(
  rows: { rowNumber: number; cells: string[] }[],
  mapping: ColumnMapping,
  opts: { challengeFilter?: string; fillDownTeam?: boolean; teams?: Set<string> } = {},
): MappedRow[] {
  const get = (cells: string[], field: ImportField) => (mapping[field] === undefined ? "" : clean(cells[mapping[field]!]));

  let mapped: MappedRow[] = rows
    .map(({ rowNumber, cells }) => ({
      rowNumber,
      full_name: get(cells, "full_name"),
      registration: get(cells, "registration"),
      email: get(cells, "email").toLowerCase(),
      team_name: get(cells, "team_name"),
      challenge: get(cells, "challenge"),
      errors: [] as string[],
      warnings: [] as string[],
    }))
    .filter((r) => r.full_name || r.registration || r.team_name || r.email);

  // Células mescladas / agrupadas: a equipe aparece só na primeira linha do grupo
  if (opts.fillDownTeam) {
    let current = "";
    for (const r of mapped) {
      if (r.team_name) current = r.team_name;
      else if (current && (r.full_name || r.registration)) r.team_name = current;
    }
    let currentChallenge = "";
    for (const r of mapped) {
      if (r.challenge) currentChallenge = r.challenge;
      else if (currentChallenge) r.challenge = currentChallenge;
    }
  }
  // linhas que repetem o cabeçalho ou só têm a equipe (sem aluno) são descartadas
  mapped = mapped.filter((r) => r.full_name || r.registration || r.email);

  if (opts.teams) mapped = mapped.filter((r) => opts.teams!.has(r.team_name));

  if (opts.challengeFilter !== undefined && mapping.challenge !== undefined) {
    mapped = mapped.filter((r) => r.challenge === opts.challengeFilter);
  }

  const byReg = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const r of mapped) {
    if (!r.full_name) r.errors.push("Nome do aluno ausente");
    if (!r.team_name) r.errors.push("Equipe ausente");
    if (r.email && !EMAIL_RE.test(r.email)) {
      r.warnings.push("E-mail inválido (será ignorado)");
      r.email = "";
    }
    if (r.registration) {
      const key = r.registration.toLowerCase();
      byReg.set(key, (byReg.get(key) ?? 0) + 1);
    } else if (r.full_name) {
      const key = normalizeHeader(r.full_name);
      byName.set(key, (byName.get(key) ?? 0) + 1);
    }
  }
  for (const r of mapped) {
    if (r.registration && (byReg.get(r.registration.toLowerCase()) ?? 0) > 1) {
      r.errors.push("Matrícula repetida no arquivo");
    }
    if (!r.registration && r.full_name && (byName.get(normalizeHeader(r.full_name)) ?? 0) > 1) {
      r.warnings.push("Nome repetido no arquivo, sem matrícula");
    }
  }
  return mapped;
}

export function distinctValues(rows: { cells: string[] }[], column: number | undefined): string[] {
  if (column === undefined) return [];
  return [...new Set(rows.map((r) => clean(r.cells[column])).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { numeric: true }),
  );
}
