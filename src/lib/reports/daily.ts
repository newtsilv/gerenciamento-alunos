import type ExcelJS from "exceljs";
import { DELIVERABLE_STATUS, EVALUATION_STATUS, FOLLOWUP_STATUS, PREVIOUS_DIFFICULTY_STATUS } from "@/lib/domain/constants";
import { average } from "@/lib/domain/scores";
import { formatDate } from "@/lib/domain/dates";
import { addSummarySheet, addTableSheet, highlightCell, newWorkbook, type ColumnSpec } from "./excel";
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

function studentHasContent(s: ReportStudentEval) {
  return s.absent || !!s.followup_status || !!s.notes.trim() || !!s.difficulty.trim() || !!s.guidance.trim() || Object.keys(s.scores).length > 0;
}

function toneFor(status: string | null | undefined): "success" | "warning" | "danger" | "muted" | null {
  if (status === "evoluindo_bem") return "success";
  if (status === "precisa_atencao") return "warning";
  if (status === "necessita_intervencao") return "danger";
  if (status === NOT_EVALUATED) return "muted";
  return null;
}

export function buildDailyWorkbook(data: ReportData, date: string): ExcelJS.Workbook {
  const wb = newWorkbook();
  const session = data.sessions.find((s) => s.date === date);
  const evals = session?.evaluations ?? [];
  const evalByTeam = new Map(evals.map((e) => [e.team_id, e]));
  const teams = data.teams.filter((t) => t.active || evalByTeam.has(t.id));
  const roster = session?.roster ?? {};
  const teamCrit = criteriaFor(data, session ? [session] : [], "equipe");
  const studCrit = criteriaFor(data, session ? [session] : [], "aluno");

  // ---------- dados derivados
  type StudentRow = { studentId: string; teamId: string; teamName: string; ev: ReportStudentEval | null; monitor: string; teamEvalStatus: string | null };
  const studentRows: StudentRow[] = [];
  for (const t of teams) {
    const te = evalByTeam.get(t.id);
    const ids = new Set([...(roster[t.id] ?? []), ...(te?.students.map((s) => s.student_id) ?? [])]);
    for (const sid of ids) {
      const ev = te?.students.find((s) => s.student_id === sid && studentHasContent(s)) ?? null;
      studentRows.push({ studentId: sid, teamId: t.id, teamName: t.name, ev, monitor: te?.monitorName || t.monitorName, teamEvalStatus: te?.status ?? null });
    }
  }
  studentRows.sort((a, b) => a.teamName.localeCompare(b.teamName, "pt-BR", { numeric: true }) || (data.students[a.studentId]?.name ?? "").localeCompare(data.students[b.studentId]?.name ?? "", "pt-BR"));

  const concluded = evals.filter((e) => e.status === "concluida");
  const drafts = evals.filter((e) => e.status === "rascunho");
  const evaluatedStudents = studentRows.filter((r) => r.ev);
  const absent = evaluatedStudents.filter((r) => r.ev!.absent);
  const attention = studentRows.filter((r) => r.ev?.followup_status === "precisa_atencao" || r.ev?.followup_status === "necessita_intervencao");

  // ---------- Aba 1 — Resumo Geral
  const ws1 = addSummarySheet(wb, "Resumo Geral", `Relatório diário — ${data.challenge.name}`, [
    {
      heading: "Identificação",
      items: [
        ["Desafio", data.challenge.name],
        ["Empresa parceira", data.challenge.company || "—"],
        ["Data do acompanhamento", session ? formatDate(date, "dd/MM/yyyy (EEEE)") : `${formatDate(date)} — sem sessão de acompanhamento registrada`],
        ["Gerado em", new Date().toLocaleString("pt-BR", { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Sao_Paulo" })],
      ],
    },
    {
      heading: "Equipes",
      items: [
        ["Total de equipes", teams.length],
        ["Equipes avaliadas (concluídas)", concluded.length, "success"],
        ["Avaliações em andamento (rascunho)", drafts.length, drafts.length ? "warning" : undefined],
        ["Equipes pendentes", teams.length - concluded.length, teams.length - concluded.length ? "warning" : "success"],
      ],
    },
    {
      heading: "Alunos",
      items: [
        ["Total de alunos", studentRows.length],
        ["Alunos avaliados", evaluatedStudents.length, "success"],
        ["Alunos ausentes", absent.length],
        ["Alunos pendentes (sem avaliação)", studentRows.length - evaluatedStudents.length, studentRows.length - evaluatedStudents.length ? "warning" : "success"],
      ],
    },
    {
      heading: "Situações que precisam de atenção",
      items: [
        [FOLLOWUP_STATUS.precisa_atencao, attention.filter((a) => a.ev!.followup_status === "precisa_atencao").length, "warning"],
        [FOLLOWUP_STATUS.necessita_intervencao, attention.filter((a) => a.ev!.followup_status === "necessita_intervencao").length, "danger"],
        ...attention.map(
          (a) =>
            [
              `${data.students[a.studentId]?.name ?? "—"} (${a.teamName})`,
              `${FOLLOWUP_STATUS[a.ev!.followup_status!]}${a.ev!.difficulty ? ` — ${a.ev!.difficulty}` : ""}`,
              a.ev!.followup_status === "necessita_intervencao" ? "danger" : "warning",
            ] as [string, string, "danger" | "warning"],
        ),
      ],
    },
  ]);
  ws1.getCell("A2").value = "Notas de 1 a 5. “N/O” = não observado (fora da média). Células vazias = critério não preenchido. Ausência de avaliação não é nota zero.";
  ws1.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF919192" } };

  // ---------- Aba 2 — Avaliações Individuais
  const c2: ColumnSpec[] = [
    { header: "Aluno", key: "aluno", width: 32 },
    { header: "Matrícula", key: "matricula", width: 14 },
    { header: "Equipe", key: "equipe", width: 16 },
    { header: "Data", key: "data", width: 12, date: true },
    { header: "Monitor responsável", key: "monitor", width: 24 },
    ...studCrit.map((c) => ({ header: criterionLabel(c), key: `c_${c.id}`, width: 13, number: true })),
    { header: "Média", key: "media", width: 9, number: true },
    { header: "Presença", key: "presenca", width: 11 },
    { header: "Situação", key: "situacao", width: 24 },
    { header: "Dificuldades", key: "dificuldade", width: 40, wrap: true },
    { header: "Orientação recomendada", key: "orientacao", width: 40, wrap: true },
    { header: "Observações", key: "obs", width: 40, wrap: true },
  ];
  const r2 = studentRows.map((r) => {
    const base: Record<string, unknown> = {
      aluno: data.students[r.studentId]?.name ?? "—",
      matricula: data.students[r.studentId]?.registration ?? "",
      equipe: r.teamName,
      data: date,
      monitor: r.monitor,
    };
    if (!r.ev) return { ...base, situacao: NOT_EVALUATED, presenca: "" };
    for (const c of studCrit) base[`c_${c.id}`] = r.ev.absent ? "" : scoreCell(r.ev.scores, c.id);
    return {
      ...base,
      media: r.ev.absent ? "" : round1(average(studCrit.map((c) => r.ev!.scores[c.id]))),
      presenca: r.ev.absent ? "Ausente" : "Presente",
      situacao: r.ev.followup_status ? FOLLOWUP_STATUS[r.ev.followup_status] : "Sem situação definida",
      dificuldade: r.ev.difficulty,
      orientacao: r.ev.guidance,
      obs: r.ev.notes,
    };
  });
  const { ws: ws2, headerRowNumber: h2 } = addTableSheet(wb, "Avaliações Individuais", c2, r2);
  const sitCol = c2.findIndex((c) => c.key === "situacao") + 1;
  studentRows.forEach((r, i) => {
    const row = ws2.getRow(h2 + 1 + i);
    const tone = toneFor(r.ev ? r.ev.followup_status : NOT_EVALUATED);
    if (tone) highlightCell(row.getCell(sitCol), tone);
    if (!r.ev) for (let c = 1; c <= c2.length; c++) row.getCell(c).font = { color: { argb: "FF919192" }, italic: true };
  });

  // ---------- Aba 3 — Avaliações das Equipes
  const c3: ColumnSpec[] = [
    { header: "Equipe", key: "equipe", width: 16 },
    { header: "Monitor", key: "monitor", width: 24 },
    { header: "Status", key: "status", width: 14 },
    ...teamCrit.map((c) => ({ header: criterionLabel(c), key: `c_${c.id}`, width: 14, number: true })),
    { header: "Média", key: "media", width: 9, number: true },
    { header: "Evolução do projeto (o que desenvolveu)", key: "desenvolveu", width: 44, wrap: true },
    { header: "Entregas concluídas", key: "entregas", width: 36, wrap: true },
    { header: "Dificuldades", key: "dificuldades", width: 40, wrap: true },
    { header: "Próximas ações", key: "proximas", width: 40, wrap: true },
    { header: "Dificuldades anteriores", key: "anteriores", width: 22 },
    { header: "Observações gerais", key: "obs", width: 36, wrap: true },
  ];
  const r3 = teams.map((t) => {
    const e = evalByTeam.get(t.id);
    const base: Record<string, unknown> = { equipe: t.name, monitor: e?.monitorName || t.monitorName };
    if (!e) return { ...base, status: NOT_EVALUATED };
    for (const c of teamCrit) base[`c_${c.id}`] = scoreCell(e.scores, c.id);
    return {
      ...base,
      status: EVALUATION_STATUS[e.status],
      media: round1(average(teamCrit.map((c) => e.scores[c.id]))),
      desenvolveu: e.developed,
      entregas: e.deliveries_completed,
      dificuldades: e.difficulties,
      proximas: e.next_steps,
      anteriores: e.previous_difficulties_status ? PREVIOUS_DIFFICULTY_STATUS[e.previous_difficulties_status] : "",
      obs: e.general_notes,
    };
  });
  const { ws: ws3, headerRowNumber: h3 } = addTableSheet(wb, "Avaliações das Equipes", c3, r3);
  teams.forEach((t, i) => {
    const e = evalByTeam.get(t.id);
    const cell = ws3.getRow(h3 + 1 + i).getCell(3);
    highlightCell(cell, !e ? "muted" : e.status === "concluida" ? "success" : "warning");
    if (e?.previous_difficulties_status === "nao_resolvidas") highlightCell(ws3.getRow(h3 + 1 + i).getCell(c3.findIndex((c) => c.key === "anteriores") + 1), "danger");
  });

  // ---------- Aba 4 — Pendências
  const pend: Record<string, unknown>[] = [];
  for (const t of teams) {
    const e = evalByTeam.get(t.id);
    if (!e) pend.push({ tipo: "Equipe não avaliada", equipe: t.name, item: "—", detalhe: `Monitor: ${t.monitorName || "não atribuído"}` });
    else if (e.status === "rascunho") pend.push({ tipo: "Acompanhamento incompleto", equipe: t.name, item: "Rascunho não concluído", detalhe: `Monitor: ${e.monitorName}` });
  }
  for (const r of studentRows.filter((x) => !x.ev)) {
    pend.push({ tipo: "Aluno sem avaliação", equipe: r.teamName, item: data.students[r.studentId]?.name ?? "—", detalhe: data.students[r.studentId]?.registration ?? "" });
  }
  const teamName = new Map(data.teams.map((t) => [t.id, t.name]));
  for (const d of data.deliverables) {
    if (d.status === "concluida") continue;
    const late = d.due_date && d.due_date <= date;
    if (!late && d.status !== "bloqueada") continue;
    pend.push({
      tipo: "Entrega pendente",
      equipe: teamName.get(d.team_id) ?? "—",
      item: d.title,
      detalhe: `${DELIVERABLE_STATUS[d.status]}${d.due_date ? ` · prazo ${formatDate(d.due_date)}` : ""}`,
      prazo: d.due_date ?? "",
    });
  }
  const { ws: ws4, headerRowNumber: h4 } = addTableSheet(
    wb,
    "Pendências",
    [
      { header: "Tipo", key: "tipo", width: 26 },
      { header: "Equipe", key: "equipe", width: 16 },
      { header: "Aluno / item", key: "item", width: 36 },
      { header: "Detalhe", key: "detalhe", width: 44, wrap: true },
      { header: "Prazo", key: "prazo", width: 12, date: true },
    ],
    pend,
  );
  pend.forEach((p, i) => {
    const tone = p.tipo === "Entrega pendente" ? "danger" : p.tipo === "Aluno sem avaliação" ? "muted" : "warning";
    highlightCell(ws4.getRow(h4 + 1 + i).getCell(1), tone);
  });

  return wb;
}
