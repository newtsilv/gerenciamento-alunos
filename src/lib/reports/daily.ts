import type ExcelJS from "exceljs";
import { DELIVERABLE_STATUS, FOLLOWUP_STATUS, PREVIOUS_DIFFICULTY_STATUS, type FollowupStatus } from "@/lib/domain/constants";
import { average } from "@/lib/domain/scores";
import { formatDate } from "@/lib/domain/dates";
import { addNote, addTable, newSheet, newWorkbook, type Column, type Tone } from "./excel";
import type { ReportCriterion, ReportData, ReportSession, ReportStudentEval } from "./data";

export const NOT_EVALUATED = "Não avaliado";

export function criteriaFor(data: ReportData, sessions: ReportSession[], scope: "equipe" | "aluno"): ReportCriterion[] {
  const used = new Set<string>();
  for (const s of sessions)
    for (const e of s.evaluations) {
      if (scope === "equipe") Object.keys(e.scores).forEach((k) => used.add(k));
      else e.students.forEach((st) => Object.keys(st.scores).forEach((k) => used.add(k)));
    }
  return data.criteria
    .filter((c) => c.scope === scope && (c.is_active || used.has(c.id)))
    .sort((a, b) => a.position - b.position || a.version - b.version);
}

export function criterionLabel(c: ReportCriterion) {
  return c.is_active ? c.name : `${c.name} (v${c.version})`;
}

/** Valor da célula de nota: número, "N/O" (não observado) ou vazio (não preenchido). */
export function scoreCell(scores: Record<string, number | null> | undefined, id: string): number | string {
  if (!scores || !(id in scores)) return "";
  const v = scores[id];
  return v === null ? "N/O" : v;
}

export function round1(v: number | null): number | string {
  return v === null ? "" : Math.round(v * 10) / 10;
}

export function hasStudentContent(s: ReportStudentEval) {
  return s.absent || !!s.followup_status || !!s.notes.trim() || !!s.difficulty.trim() || !!s.guidance.trim() || Object.keys(s.scores).length > 0;
}

/** Junta textos preenchidos em uma única célula, com rótulos curtos. */
export function joinNotes(parts: [string, string | null | undefined][]) {
  return parts
    .filter(([, v]) => v && v.trim())
    .map(([label, v]) => (label ? `${label}: ${v!.trim()}` : v!.trim()))
    .join("\n");
}

// ---------- pílulas compartilhadas com o relatório semanal
export const SITUATION_OPTIONS = [...Object.values(FOLLOWUP_STATUS), "Sem situação", NOT_EVALUATED];
export function situationTone(v: unknown): Tone {
  if (v === FOLLOWUP_STATUS.evoluindo_bem) return "success";
  if (v === FOLLOWUP_STATUS.precisa_atencao) return "warning";
  if (v === FOLLOWUP_STATUS.necessita_intervencao) return "danger";
  if (v === NOT_EVALUATED) return "muted";
  return "neutral";
}
export function situationLabel(s: FollowupStatus | null | undefined) {
  return s ? FOLLOWUP_STATUS[s] : "Sem situação";
}

const TEAM_STATUS = { concluida: "Concluído", rascunho: "Em andamento" } as const;
const teamStatusTone = (v: unknown): Tone => (v === TEAM_STATUS.concluida ? "success" : v === TEAM_STATUS.rascunho ? "warning" : "muted");
const presenceTone = (v: unknown): Tone => (v === "Presente" ? "info" : v === "Ausente" ? "danger" : "muted");
const previousTone = (v: unknown): Tone =>
  v === PREVIOUS_DIFFICULTY_STATUS.resolvidas || v === PREVIOUS_DIFFICULTY_STATUS.sem_dificuldades ? "success" : v === PREVIOUS_DIFFICULTY_STATUS.nao_resolvidas ? "danger" : "warning";
export const PENDING_TONE: Record<string, Tone> = {
  "Equipe não avaliada": "warning",
  "Acompanhamento incompleto": "warning",
  "Aluno sem avaliação": "muted",
  "Aluno sem avaliação na semana": "muted",
  "Entrega pendente": "danger",
};

export function buildDailyWorkbook(data: ReportData, date: string): ExcelJS.Workbook {
  const wb = newWorkbook();
  const session = data.sessions.find((s) => s.date === date);
  const evals = session?.evaluations ?? [];
  const evalByTeam = new Map(evals.map((e) => [e.team_id, e]));
  const teams = data.teams.filter((t) => t.active || evalByTeam.has(t.id));
  const roster = session?.roster ?? {};
  const teamCrit = criteriaFor(data, session ? [session] : [], "equipe");
  const studCrit = criteriaFor(data, session ? [session] : [], "aluno");
  const dayLabel = formatDate(date, "EEEE, dd/MM/yyyy");
  const subtitle = [data.challenge.company, dayLabel].filter(Boolean).join(" · ");

  // ---------- dados derivados
  type StudentRow = { studentId: string; teamName: string; ev: ReportStudentEval | null };
  const studentRows: StudentRow[] = [];
  for (const t of teams) {
    const te = evalByTeam.get(t.id);
    const ids = new Set([...(roster[t.id] ?? []), ...(te?.students.map((s) => s.student_id) ?? [])]);
    for (const sid of ids) {
      const ev = te?.students.find((s) => s.student_id === sid && hasStudentContent(s)) ?? null;
      studentRows.push({ studentId: sid, teamName: t.name, ev });
    }
  }
  studentRows.sort(
    (a, b) =>
      a.teamName.localeCompare(b.teamName, "pt-BR", { numeric: true }) ||
      (data.students[a.studentId]?.name ?? "").localeCompare(data.students[b.studentId]?.name ?? "", "pt-BR"),
  );
  const name = (sid: string) => data.students[sid]?.name ?? "—";

  const concluded = evals.filter((e) => e.status === "concluida").length;
  const drafts = evals.filter((e) => e.status === "rascunho").length;
  const evaluated = studentRows.filter((r) => r.ev);
  const absent = evaluated.filter((r) => r.ev!.absent).length;
  const attention = studentRows.filter((r) => r.ev?.followup_status === "precisa_atencao" || r.ev?.followup_status === "necessita_intervencao");

  // ---------- Aba 1 — Resumo
  {
    const { ws, next } = newSheet(wb, "Resumo", `Acompanhamento do dia — ${data.challenge.name}`, session ? subtitle : `${subtitle} · sem acompanhamento registrado`);
    const pendingTeams = teams.length - concluded;
    const pendingStudents = studentRows.length - evaluated.length;
    const kpi = addTable(
      ws,
      next,
      "Visão geral",
      [
        { header: "Indicador", key: "k", width: 34 },
        { header: "Total", key: "v", width: 16, kind: "center", bold: true },
        { header: "Situação", key: "s", width: 26, kind: "pill", tone: (v) => (v === "Completo" ? "success" : String(v).startsWith("Faltam") || String(v).startsWith("Concluir") ? "warning" : "neutral") },
      ],
      [
        { k: "Equipes avaliadas", v: `${concluded} de ${teams.length}`, s: pendingTeams ? `Faltam ${pendingTeams}` : "Completo" },
        { k: "Avaliações em andamento", v: drafts, s: drafts ? "Concluir rascunhos" : "—" },
        { k: "Alunos avaliados", v: `${evaluated.length} de ${studentRows.length}`, s: pendingStudents ? `Faltam ${pendingStudents}` : "Completo" },
        { k: "Alunos ausentes", v: absent, s: "—" },
        { k: "Alunos que precisam de atenção", v: attention.length, s: attention.length ? "Ver lista abaixo" : "—" },
      ],
    );
    const att = addTable(
      ws,
      kpi.next,
      "Precisam de atenção",
      [
        { header: "Aluno", key: "aluno", width: 34 },
        { header: "Equipe", key: "equipe", width: 16 },
        { header: "Situação", key: "situacao", width: 26, kind: "pill", tone: situationTone },
        { header: "Dificuldade / orientação", key: "obs", width: 50, kind: "wrap" },
      ],
      attention.map((a) => ({
        aluno: name(a.studentId),
        equipe: a.teamName,
        situacao: situationLabel(a.ev!.followup_status),
        obs: joinNotes([["Dificuldade", a.ev!.difficulty], ["Orientação", a.ev!.guidance]]),
      })),
      { emptyText: "Nenhum aluno com situação de atenção neste dia." },
    );
    addNote(ws, att.next - 1, "Notas de 1 a 5 · N/O = não observado (fica fora da média) · “Não avaliado” não é nota zero.");
  }

  // ---------- Aba 2 — Equipes
  {
    const { ws, next } = newSheet(wb, "Equipes", `Equipes — ${dayLabel}`, data.challenge.name);
    const cols: Column[] = [
      { header: "Equipe", key: "equipe", width: 14, bold: true },
      { header: "Monitor", key: "monitor", width: 22, kind: "person" },
      { header: "Status", key: "status", width: 16, kind: "pill", tone: teamStatusTone, options: [...Object.values(TEAM_STATUS), NOT_EVALUATED] },
      ...teamCrit.map((c): Column => ({ header: criterionLabel(c), key: `c_${c.id}`, width: 13, kind: "number" })),
      { header: "Média", key: "media", width: 10, kind: "number", bold: true },
      { header: "Alunos avaliados", key: "alunos", width: 12, kind: "center" },
      { header: "Dificuldades anteriores", key: "anteriores", width: 20, kind: "pill", tone: previousTone },
      { header: "Avanços e entregas", key: "avancos", width: 40, kind: "wrap" },
      { header: "Dificuldades", key: "dificuldades", width: 36, kind: "wrap" },
      { header: "Próximos passos", key: "proximos", width: 36, kind: "wrap" },
    ];
    const rows = teams.map((t) => {
      const e = evalByTeam.get(t.id);
      const base: Record<string, unknown> = { equipe: t.name, monitor: e?.monitorName || t.monitorName || "" };
      const inTeam = studentRows.filter((r) => r.teamName === t.name);
      if (!e) return { ...base, status: NOT_EVALUATED, alunos: `0/${inTeam.length}` };
      for (const c of teamCrit) base[`c_${c.id}`] = scoreCell(e.scores, c.id);
      return {
        ...base,
        status: TEAM_STATUS[e.status],
        media: round1(average(teamCrit.map((c) => e.scores[c.id]))),
        alunos: `${inTeam.filter((r) => r.ev).length}/${inTeam.length}`,
        anteriores: e.previous_difficulties_status ? PREVIOUS_DIFFICULTY_STATUS[e.previous_difficulties_status] : "",
        avancos: joinNotes([["", e.developed], ["Entregas", e.deliveries_completed]]),
        dificuldades: e.difficulties,
        proximos: joinNotes([["", e.next_steps], ["Obs.", e.general_notes]]),
      };
    });
    addTable(ws, next, `Equipes · ${concluded} de ${teams.length} avaliadas`, cols, rows, { freeze: true, filter: true });
  }

  // ---------- Aba 3 — Alunos
  {
    const { ws, next } = newSheet(wb, "Alunos", `Alunos — ${dayLabel}`, data.challenge.name);
    const cols: Column[] = [
      { header: "Aluno", key: "aluno", width: 34, bold: true },
      { header: "Equipe", key: "equipe", width: 12 },
      { header: "RA", key: "ra", width: 12 },
      { header: "Presença", key: "presenca", width: 13, kind: "pill", tone: presenceTone, options: ["Presente", "Ausente"] },
      ...studCrit.map((c): Column => ({ header: criterionLabel(c), key: `c_${c.id}`, width: 13, kind: "number" })),
      { header: "Média", key: "media", width: 10, kind: "number", bold: true },
      { header: "Situação", key: "situacao", width: 25, kind: "pill", tone: situationTone, options: SITUATION_OPTIONS },
      { header: "Observações", key: "obs", width: 50, kind: "wrap" },
    ];
    const rows = studentRows.map((r) => {
      const base: Record<string, unknown> = { aluno: name(r.studentId), equipe: r.teamName, ra: data.students[r.studentId]?.registration ?? "" };
      if (!r.ev) return { ...base, presenca: "", situacao: NOT_EVALUATED };
      for (const c of studCrit) base[`c_${c.id}`] = r.ev.absent ? "" : scoreCell(r.ev.scores, c.id);
      return {
        ...base,
        presenca: r.ev.absent ? "Ausente" : "Presente",
        media: r.ev.absent ? "" : round1(average(studCrit.map((c) => r.ev!.scores[c.id]))),
        situacao: situationLabel(r.ev.followup_status),
        obs: joinNotes([["Dificuldade", r.ev.difficulty], ["Orientação", r.ev.guidance], ["", r.ev.notes]]),
      };
    });
    addTable(ws, next, `Alunos · ${evaluated.length} de ${studentRows.length} avaliados`, cols, rows, { freeze: true, filter: true });
  }

  // ---------- Aba 4 — Pendências
  {
    const pend: Record<string, unknown>[] = [];
    for (const t of teams) {
      const e = evalByTeam.get(t.id);
      if (!e) pend.push({ tipo: "Equipe não avaliada", equipe: t.name, item: "—", detalhe: t.monitorName ? `Monitor: ${t.monitorName}` : "Sem monitor" });
      else if (e.status === "rascunho") pend.push({ tipo: "Acompanhamento incompleto", equipe: t.name, item: "Rascunho não concluído", detalhe: `Monitor: ${e.monitorName}` });
    }
    // alunos sem avaliação só nas equipes avaliadas (nas demais, a própria equipe já está pendente), um por linha de equipe
    const evaluatedTeams = new Set(teams.filter((t) => evalByTeam.has(t.id)).map((t) => t.name));
    const missing = new Map<string, string[]>();
    for (const r of studentRows.filter((x) => !x.ev && evaluatedTeams.has(x.teamName))) missing.set(r.teamName, [...(missing.get(r.teamName) ?? []), name(r.studentId)]);
    for (const [team, names] of missing) pend.push({ tipo: "Aluno sem avaliação", equipe: team, item: `${names.length} aluno(s)`, detalhe: names.join(", ") });
    const teamName = new Map(data.teams.map((t) => [t.id, t.name]));
    for (const d of data.deliverables) {
      if (d.status === "concluida") continue;
      const late = d.due_date && d.due_date <= date;
      if (!late && d.status !== "bloqueada") continue;
      pend.push({ tipo: "Entrega pendente", equipe: teamName.get(d.team_id) ?? "—", item: d.title, detalhe: DELIVERABLE_STATUS[d.status], prazo: d.due_date ?? "" });
    }
    const { ws, next } = newSheet(wb, "Pendências", `Pendências — ${dayLabel}`, data.challenge.name);
    addTable(
      ws,
      next,
      `Pendências · ${pend.length}`,
      [
        { header: "Tipo", key: "tipo", width: 26, kind: "pill", tone: (v) => PENDING_TONE[String(v)] ?? "neutral" },
        { header: "Equipe", key: "equipe", width: 14 },
        { header: "Item", key: "item", width: 26 },
        { header: "Detalhe", key: "detalhe", width: 50, kind: "wrap" },
        { header: "Prazo", key: "prazo", width: 13, kind: "date" },
      ],
      pend,
      { freeze: true, filter: true, emptyText: "Nenhuma pendência. Tudo em dia!" },
    );
  }

  return wb;
}
