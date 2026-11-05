import { describe, expect, it } from "vitest";
import { guessMapping, mapRows } from "@/lib/import/mapping";

describe("guessMapping", () => {
  it("reconhece cabeçalhos comuns sem estrutura fixa", () => {
    expect(guessMapping(["EQUIPE", "RA", "ALUNO", "CURSO", "PERÍODO", "TURNO"])).toEqual({ team_name: 0, registration: 1, full_name: 2 });
    expect(guessMapping(["Nome Completo", "Matrícula", "E-mail institucional", "Time"])).toEqual({
      full_name: 0,
      registration: 1,
      email: 2,
      team_name: 3,
    });
  });
});

describe("mapRows", () => {
  const mapping = { team_name: 0, registration: 1, full_name: 2 };
  const rows = [
    { rowNumber: 2, cells: ["M21", "22116", "LUCAS"] },
    { rowNumber: 3, cells: ["", "42526", "JOÃO"] },
    { rowNumber: 4, cells: ["M22", "101366", "PEDRO"] },
    { rowNumber: 5, cells: ["", "101366", "PEDRO DUPLICADO"] },
    { rowNumber: 6, cells: ["M22", "", "SEM RA"] },
    { rowNumber: 7, cells: ["M22", "", "SEM RA"] },
  ];

  it("herda a equipe em células mescladas", () => {
    const out = mapRows(rows, mapping, { fillDownTeam: true });
    expect(out.find((r) => r.full_name === "JOÃO")?.team_name).toBe("M21");
  });

  it("sem herança, equipe vazia é erro", () => {
    const out = mapRows(rows, mapping);
    expect(out.find((r) => r.full_name === "JOÃO")?.errors).toContain("Equipe ausente");
  });

  it("detecta matrícula repetida e nomes repetidos sem matrícula", () => {
    const out = mapRows(rows, mapping, { fillDownTeam: true });
    expect(out.filter((r) => r.errors.includes("Matrícula repetida no arquivo"))).toHaveLength(2);
    expect(out.filter((r) => r.warnings.includes("Nome repetido no arquivo, sem matrícula"))).toHaveLength(2);
  });

  it("filtra as equipes selecionadas", () => {
    const out = mapRows(rows, mapping, { fillDownTeam: true, teams: new Set(["M21"]) });
    expect(out.map((r) => r.full_name)).toEqual(["LUCAS", "JOÃO"]);
  });
});
