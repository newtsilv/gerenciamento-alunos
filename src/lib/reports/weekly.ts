import type ExcelJS from "exceljs";
import type { FollowupStatus } from "@/lib/domain/constants";
import { average, delta } from "@/lib/domain/scores";
import { formatDate, todayISO } from "@/lib/domain/dates";
import { addNote, addTable, newSheet, newWorkbook, type Column, type Tone } from "./excel";
import { NOT_EVALUATED, PENDING_TONE, SITUATION_OPTIONS, criteriaFor, hasStudentContent, round1, situationLabel, situationTone } from "./daily";
import type { ReportData, ReportTeamEval } from "./data";

const NOT_COMPARABLE = "Não comparável";

function deltaCell(v: number | null): number | string {
  return v === null ? NOT_COMPARABLE : Math.round(v * 10) / 10;
}

const yesNoTone = (v: unknown): Tone => (v === "Sim" ? "danger" : v === "Não" ? "success" : "neutral");

export function buildWeeklyWorkbook(data: ReportData, range: { start: string; end: string }, today = todayISO()): ExcelJS.Workbook {
  const wb = newWorkbook();
  // dias futuros da semana ainda não aconteceram: não entram nas contas
  const sessions = data.sessions.filter((s) => s.date >= range.start && s.date <= range.end && s.date <= today);
  const teamCrit = criteriaFor(data, sessions, "equipe");
  const studCrit = criteriaFor(data, sessions, "aluno");
  const teams = data.teams.filter((t) => t.active || sessions.some((s) => s.evaluations.some((e) => e.team_id === t.id)));
  const teamName = new Map(data.teams.map((t) => [t.id, t.name]));
  const dateLabel = (d: string) => formatDate(d, "dd/MM (EEE)");
  const weekLabel = `Semana de ${formatDate(range.start)} a ${formatDate(range.end)}`;
  const subtitle = [data.challenge.company, weekLabel].filter(Boolean).join(" · ");
  const lastIdx = sessions.length - 1;

  const evalOf = (i: number, teamId: string): ReportTeamEval | undefined => sessions[i]?.evaluations.find((e) => e.team_id === teamId);
  const teamAvg = (e?: ReportTeamEval) => (e ? average(teamCrit.map((c) => e.scores[c.id])) : null);

  // ----- alunos (a equipe pode mudar durante a semana)
  const studentIds = new Set<string>();
  for (const s of sessions) {
    Object.values(s.roster).forEach((ids) => ids.forEach((id) => studentIds.add(id)));
    s.evaluations.forEach((e) => e.students.forEach((st) => studentIds.add(st.student_id)));
  }
  const studentEval = (i: number, sid: string) => {
    for (const e of sessions[i]?.evaluations ?? []) {
      const st = e.students.find((x) => x.student_id === sid && hasStudentContent(x));
      if (st) return st;
    }
    return undefined;
  };
  const studentTeamOn = (i: number, sid: string) => {
    const s = sessions[i];
    if (!s) return undefined;
    return Object.entries(s.roster).find(([, ids]) => ids.includes(sid))?.[0] ?? studentEval(i, sid)?.team_id;
  };
  const name = (sid: string) => data.students[sid]?.name ?? "—";

  const lastStatus = new Map<string, FollowupStatus | null>();
  for (const sid of studentIds) {
    for (let i = lastIdx; i >= 0; i--) {
      const ev = studentEval(i, sid);
      if (ev) {
        lastStatus.set(sid, ev.followup_status);
        break;
      }
    }
  }
  const attention = [...lastStatus.entries()].filter(([, s]) => s === "precisa_atencao" || s === "necessita_intervencao");

  // ----- Aba 1 — Resumo
  {
    const { ws, next } = newSheet(wb, "Resumo", `Relatório semanal — ${data.challenge.name}`, subtitle);

    const perSession = sessions.map((s) => {
      const concluded = s.evaluations.filter((e) => e.status === "concluida").length;
      const rosterCount = Object.values(s.roster).reduce((n, ids) => n + ids.length, 0);
      const evaluated = s.evaluations.reduce((n, e) => n + e.students.filter(hasStudentContent).length, 0);
      const avg = average(s.evaluations.flatMap((e) => teamCrit.map((c) => e.scores[c.id])));
      return { dia: dateLabel(s.date), equipes: `${concluded} de ${teams.length}`, alunos: `${evaluated} de ${rosterCount}`, media: avg === null ? NOT_EVALUATED : round1(avg), ok: concluded >= teams.length };
    });
    const days = addTable(
      ws,
      next,
      "Acompanhamentos da semana",
      [
        { header: "Dia", key: "dia", width: 34, bold: true },
        { header: "Equipes avaliadas", key: "equipes", width: 16, kind: "center" },
        { header: "Alunos avaliados", key: "alunos", width: 26, kind: "center" },
        { header: "Média coletiva", key: "media", width: 16, kind: "number", bold: true },
        { header: "Situação", key: "status", width: 18, kind: "pill", tone: (v) => (v === "Completo" ? "success" : "warning") },
      ],
      perSession.map((p) => ({ ...p, status: p.ok ? "Completo" : "Incompleto" })),
      { emptyText: "Nenhum acompanhamento registrado nesta semana." },
    );

    const highlights: string[] = [];
    const avgs = perSession.map((p) => (typeof p.media === "number" ? p.media : null));
    if (avgs.length >= 2 && avgs[0] !== null && avgs[lastIdx] !== null) {
      const d = avgs[lastIdx]! - avgs[0]!;
      highlights.push(`A média coletiva ${d > 0 ? "subiu" : d < 0 ? "caiu" : "ficou estável"}${d ? ` ${Math.abs(d).toFixed(1).replace(".", ",")} ponto(s)` : ""} de ${perSession[0].dia} para ${perSession[lastIdx].dia}.`);
    }
    const recurrent = teams.filter((t) => sessions.filter((_, i) => evalOf(i, t.id)?.difficulties.trim()).length > 1 || sessions.some((_, i) => evalOf(i, t.id)?.previous_difficulties_status === "nao_resolvidas"));
    if (recurrent.length) highlights.push(`${recurrent.length} equipe(s) com dificuldades recorrentes ou não resolvidas: ${recurrent.map((t) => t.name).join(", ")}.`);
    if (attention.length) highlights.push(`${attention.length} aluno(s) precisam de atenção ou intervenção (última avaliação da semana).`);
    const hl = addTable(ws, days.next, "Destaques", [{ header: "O que observar", key: "t", width: 34, kind: "wrap" }], highlights.map((t) => ({ t })));
    // destaques ocupam a largura toda da tabela de cima
    for (let r = hl.headerRowNumber; r < hl.next - 2; r++) ws.mergeCells(r, 1, r, 5);
    highlights.forEach((t, i) => (ws.getRow(hl.headerRowNumber + 1 + i).height = Math.max(24, Math.ceil(t.length / 115) * 15 + 8)));

    const att = addTable(
      ws,
      hl.next,
      "Alunos que precisam de atenção",
      [
        { header: "Aluno", key: "aluno", width: 34 },
        { header: "Equipe", key: "equipe", width: 16 },
        { header: "Situação", key: "situacao", width: 26, kind: "pill", tone: situationTone },
      ],
      attention.map(([sid, st]) => ({ aluno: name(sid), equipe: teamName.get(studentTeamOn(lastIdx, sid) ?? "") ?? "", situacao: situationLabel(st) })),
      { emptyText: "Nenhum aluno em atenção nesta semana." },
    );
    addNote(ws, att.next - 1, "“Não avaliado” não é nota baixa · variações só são calculadas quando há avaliação nos dois dias.");
  }

  // ----- Aba 2 — Equipes
  {
    const { ws, next } = newSheet(wb, "Equipes", `Equipes — ${weekLabel}`, data.challenge.name);
    const cols: Column[] = [
      { header: "Equipe", key: "equipe", width: 14, bold: true },
      { header: "Monitor", key: "monitor", width: 22, kind: "person" },
      ...sessions.map((s, i): Column => ({ header: `Média ${dateLabel(s.date)}`, key: `m${i}`, width: 15, kind: "number" })),
      { header: "Variação", key: "delta", width: 15, kind: "delta" },
      { header: "Dificuldade recorrente", key: "rec", width: 16, kind: "pill", tone: yesNoTone, options: ["Sim", "Não"] },
      { header: "Dificuldades da semana", key: "dif", width: 46, kind: "wrap" },
    ];
    const rows = teams.map((t) => {
      const row: Record<string, unknown> = { equipe: t.name, monitor: t.monitorName };
      sessions.forEach((_, i) => {
        const e = evalOf(i, t.id);
        row[`m${i}`] = !e ? NOT_EVALUATED : teamAvg(e) === null ? "N/O" : round1(teamAvg(e));
      });
      row.delta = sessions.length >= 2 ? deltaCell(delta(teamAvg(evalOf(0, t.id)), teamAvg(evalOf(lastIdx, t.id)))) : "";
      const texts = sessions.map((s, i) => [dateLabel(s.date), evalOf(i, t.id)?.difficulties.trim() ?? ""] as const).filter(([, x]) => x);
      const unresolved = sessions.some((_, i) => evalOf(i, t.id)?.previous_difficulties_status === "nao_resolvidas");
      row.rec = texts.length > 1 || unresolved ? "Sim" : texts.length ? "Não" : "";
      row.dif = texts.map(([d, x]) => `${d}: ${x}`).join("\n");
      return row;
    });
    addTable(ws, next, `Evolução das equipes · ${sessions.length} acompanhamento(s)`, cols, rows, { freeze: true, filter: true });
  }

  // ----- Aba 3 — Alunos
  const sidList = [...studentIds].sort((a, b) => {
    const ta = teamName.get(studentTeamOn(lastIdx, a) ?? "") ?? "";
    const tb = teamName.get(studentTeamOn(lastIdx, b) ?? "") ?? "";
    return ta.localeCompare(tb, "pt-BR", { numeric: true }) || name(a).localeCompare(name(b), "pt-BR");
  });
  {
    const { ws, next } = newSheet(wb, "Alunos", `Alunos — ${weekLabel}`, data.challenge.name);
    const cols: Column[] = [
      { header: "Aluno", key: "aluno", width: 34, bold: true },
      { header: "Equipe", key: "equipe", width: 18 },
      ...sessions.map((s, i): Column => ({ header: `Média ${dateLabel(s.date)}`, key: `m${i}`, width: 15, kind: "number" })),
      { header: "Variação", key: "delta", width: 15, kind: "delta" },
      { header: "Situação atual", key: "situacao", width: 25, kind: "pill", tone: situationTone, options: SITUATION_OPTIONS },
      { header: "Dificuldade recorrente", key: "rec", width: 16, kind: "pill", tone: yesNoTone, options: ["Sim", "Não"] },
      { header: "Último compromisso", key: "orientacao", width: 44, kind: "wrap" },
    ];
    const rows = sidList.map((sid) => {
      const teamsOfWeek = [...new Set(sessions.map((_, i) => studentTeamOn(i, sid)).filter(Boolean))].map((id) => teamName.get(id!) ?? "");
      const row: Record<string, unknown> = { aluno: name(sid), equipe: teamsOfWeek.join(" → ") };
      let difficulties = 0;
      const avgs = sessions.map((_, i) => {
        const ev = studentEval(i, sid);
        if (!ev) {
          row[`m${i}`] = NOT_EVALUATED;
          return null;
        }
        if (ev.difficulty.trim()) difficulties++;
        const a = ev.absent ? null : average(studCrit.map((c) => ev.scores[c.id]));
        row[`m${i}`] = ev.absent ? "Ausente" : a === null ? "N/O" : round1(a);
        if (ev.commitments || ev.guidance) row.orientacao = ev.commitments || ev.guidance;
        return a;
      });
      row.delta = sessions.length >= 2 ? deltaCell(delta(avgs[0], avgs[avgs.length - 1])) : "";
      row.situacao = lastStatus.has(sid) ? situationLabel(lastStatus.get(sid)) : NOT_EVALUATED;
      row.rec = difficulties > 1 ? "Sim" : difficulties ? "Não" : "";
      return row;
    });
    addTable(ws, next, `Evolução individual · ${sidList.length} aluno(s)`, cols, rows, { freeze: true, filter: true });
  }

  // ----- Aba 4 — Pendências
  {
    const pend: Record<string, unknown>[] = [];
    // uma linha por equipe, com os dias em que ficou sem avaliação
    for (const t of teams) {
      const missed = sessions.filter((_, i) => !evalOf(i, t.id)).map((s) => dateLabel(s.date));
      const drafts = sessions.filter((_, i) => evalOf(i, t.id)?.status === "rascunho").map((s) => dateLabel(s.date));
      const monitor = t.monitorName ? `Monitor: ${t.monitorName}` : "Sem monitor";
      if (missed.length) pend.push({ tipo: "Equipe não avaliada", equipe: t.name, item: missed.join(", "), detalhe: monitor });
      if (drafts.length) pend.push({ tipo: "Acompanhamento incompleto", equipe: t.name, item: drafts.join(", "), detalhe: `Rascunho · ${monitor}` });
    }
    // alunos sem nenhuma avaliação na semana, agrupados por equipe (só em equipes que tiveram algum acompanhamento)
    const missing = new Map<string, string[]>();
    for (const sid of sidList) {
      if (sessions.some((_, i) => studentEval(i, sid))) continue;
      const tId = studentTeamOn(lastIdx, sid) ?? "";
      if (!sessions.some((_, i) => evalOf(i, tId))) continue;
      const team = teamName.get(tId) ?? "—";
      missing.set(team, [...(missing.get(team) ?? []), name(sid)]);
    }
    for (const [team, names] of missing) pend.push({ tipo: "Aluno sem avaliação na semana", equipe: team, item: `${names.length} aluno(s)`, detalhe: names.join(", ") });
    const { ws, next } = newSheet(wb, "Pendências", `Pendências — ${weekLabel}`, data.challenge.name);
    addTable(
      ws,
      next,
      `Pendências · ${pend.length}`,
      [
        { header: "Tipo", key: "tipo", width: 30, kind: "pill", tone: (v) => PENDING_TONE[String(v)] ?? "neutral" },
        { header: "Equipe", key: "equipe", width: 14 },
        { header: "Item", key: "item", width: 26 },
        { header: "Detalhe", key: "detalhe", width: 50, kind: "wrap" },
      ],
      pend,
      { freeze: true, filter: true, emptyText: "Nenhuma pendência na semana. Tudo em dia!" },
    );
  }

  return wb;
}
