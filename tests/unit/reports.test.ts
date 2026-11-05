import { describe, expect, it } from "vitest";
import { buildDailyWorkbook, NOT_EVALUATED } from "@/lib/reports/daily";
import { buildWeeklyWorkbook } from "@/lib/reports/weekly";
import type { ReportData } from "@/lib/reports/data";

const crit = (id: string, scope: "equipe" | "aluno", position: number) => ({ id, scope, name: `C-${id}`, position, version: 1, is_active: true });

function fixture(): ReportData {
  return {
    challenge: { id: "c1", name: "Desafio", company: "Empresa" },
    teams: [
      { id: "t1", name: "Equipe 01", monitorName: "Ana", active: true },
      { id: "t4", name: "Equipe 04", monitorName: "Bia", active: true },
    ],
    students: { s1: { name: "João", registration: "1" }, s2: { name: "Maria", registration: "2" } },
    criteria: [crit("e1", "equipe", 1), crit("a1", "aluno", 1), crit("a2", "aluno", 2)],
    sessions: [
      {
        id: "d1",
        date: "2026-11-04",
        roster: { t1: ["s1", "s2"] },
        evaluations: [
          {
            id: "te1",
            team_id: "t1",
            status: "concluida",
            monitorName: "Ana",
            developed: "",
            difficulties: "API",
            deliveries_completed: "",
            next_steps: "",
            general_notes: "",
            previous_difficulties_status: null,
            scores: { e1: 4 },
            students: [
              { student_id: "s1", team_id: "t1", absent: false, followup_status: "precisa_atencao", notes: "", difficulty: "Git", guidance: "", scores: { a1: 2, a2: null } },
            ],
          },
        ],
      },
      {
        id: "d2",
        date: "2026-11-06",
        // João foi transferido para a Equipe 04 em 05/11
        roster: { t1: ["s2"], t4: ["s1"] },
        evaluations: [
          {
            id: "te2",
            team_id: "t4",
            status: "concluida",
            monitorName: "Bia",
            developed: "",
            difficulties: "",
            deliveries_completed: "",
            next_steps: "",
            general_notes: "",
            previous_difficulties_status: null,
            scores: { e1: 5 },
            students: [
              { student_id: "s1", team_id: "t4", absent: false, followup_status: "evoluindo_bem", notes: "", difficulty: "Git", guidance: "", scores: { a1: 4, a2: 4 } },
            ],
          },
        ],
      },
    ],
    deliverables: [{ team_id: "t1", title: "Protótipo", status: "em_andamento", due_date: "2026-11-01", completed_at: null }],
  };
}

function rowsOf(ws: import("exceljs").Worksheet) {
  const out: unknown[][] = [];
  ws.eachRow((r) => out.push((r.values as unknown[]).slice(1)));
  return out;
}

describe("relatório diário", () => {
  const wb = buildDailyWorkbook(fixture(), "2026-11-04");

  it("gera as quatro abas", () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo Geral", "Avaliações Individuais", "Avaliações das Equipes", "Pendências"]);
  });

  it("aluno sem avaliação aparece como 'Não avaliado', sem nota zero", () => {
    const rows = rowsOf(wb.getWorksheet("Avaliações Individuais")!);
    const maria = rows.find((r) => r[0] === "Maria")!;
    expect(maria).toContain(NOT_EVALUATED);
    expect(maria).not.toContain(0);
  });

  it("'Não observado' sai como N/O e fica fora da média", () => {
    const rows = rowsOf(wb.getWorksheet("Avaliações Individuais")!);
    const joao = rows.find((r) => r[0] === "João")!;
    expect(joao).toContain("N/O");
    expect(joao).toContain(2); // média = 2 (somente a1)
  });

  it("lista equipe não avaliada e entrega vencida nas pendências", () => {
    const rows = rowsOf(wb.getWorksheet("Pendências")!);
    expect(rows.some((r) => r[0] === "Equipe não avaliada" && r[1] === "Equipe 04")).toBe(true);
    expect(rows.some((r) => r[0] === "Entrega pendente" && r[2] === "Protótipo")).toBe(true);
  });
});

describe("relatório semanal", () => {
  const wb = buildWeeklyWorkbook(fixture(), { start: "2026-11-02", end: "2026-11-08" });

  it("consolida evolução individual com transferência e variação", () => {
    const rows = rowsOf(wb.getWorksheet("Evolução Individual")!);
    const joao = rows.find((r) => r[0] === "João")!;
    expect(joao[2]).toBe("Equipe 01 → Equipe 04");
    expect(joao).toContain(2); // variação 2 → 4
  });

  it("diferencia ausência de avaliação de nota baixa", () => {
    const rows = rowsOf(wb.getWorksheet("Evolução das Equipes")!);
    const e01 = rows.find((r) => r[0] === "Equipe 01")!;
    expect(e01).toContain("Não avaliado");
    expect(e01).toContain("Não comparável");
  });

  it("marca dificuldades recorrentes", () => {
    const rows = rowsOf(wb.getWorksheet("Dificuldades Recorrentes")!);
    expect(rows.find((r) => r[2] === "João")?.at(-1)).toBe("Sim");
  });
});
