import type ExcelJS from "exceljs";
import { DELIVERABLE_STATUS, FOLLOWUP_STATUS, PREVIOUS_DIFFICULTY_STATUS, type FollowupStatus } from "@/lib/domain/constants";
import { average, delta } from "@/lib/domain/scores";
import { formatDate } from "@/lib/domain/dates";
import { addSummarySheet, addTableSheet, highlightCell, newWorkbook, type ColumnSpec } from "./excel";
import { NOT_EVALUATED, criteriaFor, criterionLabel, round1 } from "./daily";
import type { ReportData, ReportStudentEval, ReportTeamEval } from "./data";

function hasContent(s: ReportStudentEval) {
  return s.absent || !!s.followup_status || !!s.notes.trim() || !!s.difficulty.trim() || !!s.guidance.trim() || Object.keys(s.scores).length > 0;
}

function deltaCell(v: number | null): number | string {
  return v === null ? "Não comparável" : Math.round(v * 10) / 10;
}

export function buildWeeklyWorkbook(data: ReportData, range: { start: string; end: string }): ExcelJS.Workbook {
  const wb = newWorkbook();
  const sessions = data.sessions.filter((s) => s.date >= range.start && s.date <= range.end);
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  const teamCrit = criteriaFor(data, sessions, "equipe");
  const studCrit = criteriaFor(data, sessions, "aluno");
  const teams = data.teams.filter((t) => t.active || sessions.some((s) => s.evaluations.some((e) => e.team_id === t.id)));
  const teamName = new Map(data.teams.map((t) => [t.id, t.name]));
  const dateLabel = (d: string) => formatDate(d, "dd/MM (EEE)");

  const evalOf = (sessionIdx: number, teamId: string): ReportTeamEval | undefined =>
    sessions[sessionIdx]?.evaluations.find((e) => e.team_id === teamId);
  const teamAvg = (e?: ReportTeamEval) => (e ? average(teamCrit.map((c) => e.scores[c.id])) : null);

  // ----- alunos (a equipe pode mudar durante a semana)
  const studentIds = new Set<string>();
  for (const s of sessions) {
    Object.values(s.roster).forEach((ids) => ids.forEach((id) => studentIds.add(id)));
    s.evaluations.forEach((e) => e.students.forEach((st) => studentIds.add(st.student_id)));
  }
  const studentEval = (sessionIdx: number, sid: string) => {
    for (const e of sessions[sessionIdx]?.evaluations ?? []) {
      const st = e.students.find((x) => x.student_id === sid && hasContent(x));
      if (st) return st;
    }
    return undefined;
  };
  const studentTeamOn = (sessionIdx: number, sid: string) => {
    const s = sessions[sessionIdx];
    if (!s) return undefined;
    return Object.entries(s.roster).find(([, ids]) => ids.includes(sid))?.[0] ?? studentEval(sessionIdx, sid)?.team_id;
  };

  // ----- indicadores gerais
  const perSession = sessions.map((s) => {
    const concluded = s.evaluations.filter((e) => e.status === "concluida").length;
    const rosterCount = Object.values(s.roster).reduce((n, ids) => n + ids.length, 0);
    const evaluated = s.evaluations.reduce((n, e) => n + e.students.filter(hasContent).length, 0);
    const avg = average(s.evaluations.flatMap((e) => teamCrit.map((c) => e.scores[c.id])));
    return { date: s.date, concluded, rosterCount, evaluated, avg };
  });

  const lastStatus = new Map<string, FollowupStatus | null>();
  for (const sid of studentIds) {
    for (let i = sessions.length - 1; i >= 0; i--) {
      const ev = studentEval(i, sid);
      if (ev) {
        lastStatus.set(sid, ev.followup_status);
        break;
      }
    }
  }
  const attentionStudents = [...lastStatus.entries()].filter(([, s]) => s === "precisa_atencao" || s === "necessita_intervencao");

  // ----- dificuldades recorrentes
  type Diff = { tipo: string; equipe: string; nome: string; textos: string[]; recorrente: boolean };
  const diffs: Diff[] = [];
  for (const t of teams) {
    const texts = sessions.map((_, i) => evalOf(i, t.id)?.difficulties.trim() ?? "");
    const filled = texts.filter(Boolean).length;
    const unresolved = sessions.some((_, i) => evalOf(i, t.id)?.previous_difficulties_status === "nao_resolvidas");
    if (filled) diffs.push({ tipo: "Equipe", equipe: t.name, nome: t.name, textos: texts, recorrente: filled > 1 || unresolved });
  }
  for (const sid of studentIds) {
    const texts = sessions.map((_, i) => studentEval(i, sid)?.difficulty.trim() ?? "");
    const filled = texts.filter(Boolean).length;
    if (filled) {
      const tId = studentTeamOn(sessions.length - 1, sid) ?? studentTeamOn(0, sid);
      diffs.push({ tipo: "Aluno", equipe: teamName.get(tId ?? "") ?? "—", nome: data.students[sid]?.name ?? "—", textos: texts, recorrente: filled > 1 });
    }
  }
  diffs.sort((a, b) => Number(b.recorrente) - Number(a.recorrente) || a.equipe.localeCompare(b.equipe, "pt-BR", { numeric: true }));

  const completedThisWeek = data.deliverables.filter((d) => d.status === "concluida" && d.completed_at && d.completed_at >= range.start && d.completed_at <= range.end);
  const overdue = data.deliverables.filter((d) => d.status !== "concluida" && d.due_date && d.due_date <= range.end);

  // ----- pendências
  const pend: Record<string, unknown>[] = [];
  sessions.forEach((s, i) => {
    for (const t of teams) {
      const e = evalOf(i, t.id);
      if (!e) pend.push({ data: s.date, tipo: "Equipe não avaliada", equipe: t.name, item: "—", detalhe: t.monitorName ? `Monitor: ${t.monitorName}` : "Sem monitor" });
      else if (e.status === "rascunho") pend.push({ data: s.date, tipo: "Acompanhamento incompleto", equipe: t.name, item: "Rascunho", detalhe: `Monitor: ${e.monitorName}` });
    }
  });
  for (const sid of studentIds) {
    if (sessions.every((_, i) => !studentEval(i, sid))) {
      const tId = studentTeamOn(sessions.length - 1, sid);
      pend.push({ data: "", tipo: "Aluno sem avaliação na semana", equipe: teamName.get(tId ?? "") ?? "—", item: data.students[sid]?.name ?? "—", detalhe: data.students[sid]?.registration ?? "" });
    }
  }
  for (const d of overdue) {
    pend.push({ data: d.due_date, tipo: "Entrega pendente", equipe: teamName.get(d.team_id) ?? "—", item: d.title, detalhe: DELIVERABLE_STATUS[d.status] });
  }

  // ----- Aba 1 — Resumo para o coordenador
  const highlights: string[] = [];
  if (perSession.length >= 2 && perSession[0].avg !== null && perSession[perSession.length - 1].avg !== null) {
    const d = perSession[perSession.length - 1].avg! - perSession[0].avg!;
    highlights.push(`Média coletiva ${d >= 0 ? "subiu" : "caiu"} ${Math.abs(d).toFixed(1).replace(".", ",")} ponto(s) entre ${dateLabel(perSession[0].date)} e ${dateLabel(perSession[perSession.length - 1].date)}.`);
  }
  const recurrentTeams = diffs.filter((d) => d.tipo === "Equipe" && d.recorrente).length;
  if (recurrentTeams) highlights.push(`${recurrentTeams} equipe(s) com dificuldades recorrentes ou não resolvidas.`);
  if (attentionStudents.length) highlights.push(`${attentionStudents.length} aluno(s) com situação de atenção/intervenção na última avaliação da semana.`);
  highlights.push(`${completedThisWeek.length} entrega(s) concluída(s) na semana; ${overdue.length} pendente(s) com prazo vencido.`);

  const ws1 = addSummarySheet(wb, "Resumo", `Relatório semanal — ${data.challenge.name}`, [
    {
      heading: "Identificação",
      items: [
        ["Desafio", data.challenge.name],
        ["Empresa parceira", data.challenge.company || "—"],
        ["Semana", `${formatDate(range.start)} a ${formatDate(range.end)}`],
        ["Acompanhamentos na semana", sessions.length ? sessions.map((s) => dateLabel(s.date)).join(" e ") : "Nenhuma sessão no período"],
      ],
    },
    ...perSession.map((p) => ({
      heading: `Acompanhamento de ${dateLabel(p.date)}`,
      items: [
        ["Equipes avaliadas", `${p.concluded} de ${teams.length}`, p.concluded < teams.length ? "warning" : "success"],
        ["Alunos avaliados", `${p.evaluated} de ${p.rosterCount}`, p.evaluated < p.rosterCount ? "warning" : "success"],
        ["Média coletiva", p.avg === null ? NOT_EVALUATED : round1(p.avg)],
      ] as [string, string | number, ("success" | "warning" | "danger" | "muted")?][],
    })),
    {
      heading: "Resumo para o coordenador",
      items: [
        ...highlights.map((h, i) => [`Destaque ${i + 1}`, h] as [string, string]),
        ...attentionStudents.map(
          ([sid, st]) =>
            [
              `${data.students[sid]?.name ?? "—"}`,
              `${FOLLOWUP_STATUS[st!]} · ${teamName.get(studentTeamOn(sessions.length - 1, sid) ?? "") ?? ""}`,
              st === "necessita_intervencao" ? "danger" : "warning",
            ] as [string, string, "danger" | "warning"],
        ),
      ],
    },
  ]);
  ws1.getCell("A2").value = "Avaliações ausentes aparecem como “Não avaliado” e não são consideradas nota baixa. Variações só são calculadas quando há avaliação nos dois dias.";
  ws1.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF919192" } };

  // ----- Aba 2 — Evolução das equipes
  const c2: ColumnSpec[] = [
    { header: "Equipe", key: "equipe", width: 16 },
    { header: "Monitor", key: "monitor", width: 22 },
    ...sessions.map((s, i) => ({ header: `Média ${dateLabel(s.date)}`, key: `m${i}`, width: 16, number: true })),
    { header: "Variação", key: "delta", width: 14, number: true },
    ...sessions.map((s, i) => ({ header: `Dif. anteriores ${dateLabel(s.date)}`, key: `p${i}`, width: 22 })),
  ];
  const r2 = teams.map((t) => {
    const row: Record<string, unknown> = { equipe: t.name, monitor: t.monitorName };
    sessions.forEach((_, i) => {
      const e = evalOf(i, t.id);
      row[`m${i}`] = e ? round1(teamAvg(e)) || "N/O" : NOT_EVALUATED;
      row[`p${i}`] = e?.previous_difficulties_status ? PREVIOUS_DIFFICULTY_STATUS[e.previous_difficulties_status] : "";
    });
    row.delta = sessions.length >= 2 ? deltaCell(delta(teamAvg(evalOf(0, t.id)), teamAvg(evalOf(sessions.length - 1, t.id)))) : "";
    return row;
  });
  const { ws: ws2, headerRowNumber: h2 } = addTableSheet(wb, "Evolução das Equipes", c2, r2);
  r2.forEach((r, i) => {
    const row = ws2.getRow(h2 + 1 + i);
    sessions.forEach((_, si) => {
      if (r[`m${si}`] === NOT_EVALUATED) highlightCell(row.getCell(3 + si), "muted");
    });
    const dc = row.getCell(3 + sessions.length);
    if (typeof r.delta === "number") highlightCell(dc, r.delta > 0 ? "success" : r.delta < 0 ? "danger" : "muted");
  });

  // ----- Aba 3 — Comparação por critério (formato longo, filtrável)
  const c3: ColumnSpec[] = [
    { header: "Equipe", key: "equipe", width: 16 },
    { header: "Critério", key: "criterio", width: 34 },
    ...sessions.map((s, i) => ({ header: dateLabel(s.date), key: `d${i}`, width: 14, number: true })),
    { header: "Variação", key: "delta", width: 14, number: true },
  ];
  const r3: Record<string, unknown>[] = [];
  for (const t of teams) {
    for (const c of teamCrit) {
      const row: Record<string, unknown> = { equipe: t.name, criterio: criterionLabel(c) };
      const vals = sessions.map((_, i) => {
        const e = evalOf(i, t.id);
        if (!e) {
          row[`d${i}`] = NOT_EVALUATED;
          return null;
        }
        const v = c.id in e.scores ? e.scores[c.id] : undefined;
        row[`d${i}`] = v === undefined ? "" : v === null ? "N/O" : v;
        return typeof v === "number" ? v : null;
      });
      row.delta = sessions.length >= 2 ? deltaCell(delta(vals[0], vals[vals.length - 1])) : "";
      r3.push(row);
    }
  }
  addTableSheet(wb, "Comparação por Critério", c3, r3);

  // ----- Aba 4 — Evolução individual
  const c4: ColumnSpec[] = [
    { header: "Aluno", key: "aluno", width: 30 },
    { header: "Matrícula", key: "matricula", width: 14 },
    { header: "Equipe", key: "equipe", width: 18 },
    ...sessions.flatMap((s, i) => [
      { header: `Média ${dateLabel(s.date)}`, key: `m${i}`, width: 15, number: true },
      { header: `Situação ${dateLabel(s.date)}`, key: `s${i}`, width: 22 },
    ]),
    { header: "Variação", key: "delta", width: 14, number: true },
    { header: "Última orientação", key: "orientacao", width: 40, wrap: true },
  ];
  const sidList = [...studentIds].sort((a, b) => {
    const ta = teamName.get(studentTeamOn(sessions.length - 1, a) ?? "") ?? "";
    const tb = teamName.get(studentTeamOn(sessions.length - 1, b) ?? "") ?? "";
    return ta.localeCompare(tb, "pt-BR", { numeric: true }) || (data.students[a]?.name ?? "").localeCompare(data.students[b]?.name ?? "", "pt-BR");
  });
  const r4 = sidList.map((sid) => {
    const teamsOfWeek = [...new Set(sessions.map((_, i) => studentTeamOn(i, sid)).filter(Boolean))].map((id) => teamName.get(id!) ?? "");
    const row: Record<string, unknown> = {
      aluno: data.students[sid]?.name ?? "—",
      matricula: data.students[sid]?.registration ?? "",
      equipe: teamsOfWeek.join(" → "),
    };
    const avgs = sessions.map((_, i) => {
      const ev = studentEval(i, sid);
      if (!ev) {
        row[`m${i}`] = NOT_EVALUATED;
        row[`s${i}`] = NOT_EVALUATED;
        return null;
      }
      const a = ev.absent ? null : average(studCrit.map((c) => ev.scores[c.id]));
      row[`m${i}`] = ev.absent ? "Ausente" : a === null ? "N/O" : round1(a);
      row[`s${i}`] = ev.followup_status ? FOLLOWUP_STATUS[ev.followup_status] : "Sem situação";
      if (ev.guidance) row.orientacao = ev.guidance;
      return a;
    });
    row.delta = sessions.length >= 2 ? deltaCell(delta(avgs[0], avgs[avgs.length - 1])) : "";
    return row;
  });
  const { ws: ws4, headerRowNumber: h4 } = addTableSheet(wb, "Evolução Individual", c4, r4);
  sidList.forEach((sid, i) => {
    const row = ws4.getRow(h4 + 1 + i);
    sessions.forEach((_, si) => {
      const ev = studentEval(si, sid);
      const mCell = row.getCell(4 + si * 2);
      const sCell = row.getCell(5 + si * 2);
      if (!ev) {
        highlightCell(mCell, "muted");
        highlightCell(sCell, "muted");
      } else if (ev.followup_status === "precisa_atencao") highlightCell(sCell, "warning");
      else if (ev.followup_status === "necessita_intervencao") highlightCell(sCell, "danger");
      else if (ev.followup_status === "evoluindo_bem") highlightCell(sCell, "success");
    });
    const d = r4[i].delta;
    if (typeof d === "number") highlightCell(row.getCell(4 + sessions.length * 2), d > 0 ? "success" : d < 0 ? "danger" : "muted");
  });

  // ----- Aba 5 — Dificuldades recorrentes
  const c5: ColumnSpec[] = [
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Equipe", key: "equipe", width: 16 },
    { header: "Nome", key: "nome", width: 28 },
    ...sessions.map((s, i) => ({ header: `Dificuldade ${dateLabel(s.date)}`, key: `t${i}`, width: 44, wrap: true })),
    { header: "Recorrente", key: "rec", width: 12 },
  ];
  const r5 = diffs.map((d) => ({ tipo: d.tipo, equipe: d.equipe, nome: d.nome, rec: d.recorrente ? "Sim" : "Não", ...Object.fromEntries(d.textos.map((t, i) => [`t${i}`, t])) }));
  const { ws: ws5, headerRowNumber: h5 } = addTableSheet(wb, "Dificuldades Recorrentes", c5, r5);
  diffs.forEach((d, i) => {
    if (d.recorrente) highlightCell(ws5.getRow(h5 + 1 + i).getCell(c5.length), "danger");
  });

  // ----- Aba 6 — Entregas realizadas
  addTableSheet(
    wb,
    "Entregas Realizadas",
    [
      { header: "Equipe", key: "equipe", width: 16 },
      { header: "Entrega", key: "entrega", width: 36 },
      { header: "Prazo", key: "prazo", width: 12, date: true },
      { header: "Concluída em", key: "concluida", width: 14, date: true },
      { header: "No prazo?", key: "noprazo", width: 12 },
    ],
    completedThisWeek
      .map((d) => ({
        equipe: teamName.get(d.team_id) ?? "—",
        entrega: d.title,
        prazo: d.due_date ?? "",
        concluida: d.completed_at,
        noprazo: !d.due_date ? "Sem prazo" : d.completed_at! <= d.due_date ? "Sim" : "Não",
      }))
      .sort((a, b) => a.equipe.localeCompare(b.equipe, "pt-BR", { numeric: true })),
  );

  // ----- Aba 7 — Pendências
  const { ws: ws7, headerRowNumber: h7 } = addTableSheet(
    wb,
    "Pendências",
    [
      { header: "Data / prazo", key: "data", width: 13, date: true },
      { header: "Tipo", key: "tipo", width: 30 },
      { header: "Equipe", key: "equipe", width: 16 },
      { header: "Aluno / item", key: "item", width: 34 },
      { header: "Detalhe", key: "detalhe", width: 34 },
    ],
    pend,
  );
  pend.forEach((p, i) => highlightCell(ws7.getRow(h7 + 1 + i).getCell(2), p.tipo === "Entrega pendente" ? "danger" : "warning"));

  void first;
  void last;
  return wb;
}
