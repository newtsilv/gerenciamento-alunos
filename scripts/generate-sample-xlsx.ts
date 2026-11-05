/**
 * Gera samples/importacao-exemplo.xlsx com 12 equipes e alunos FICTÍCIOS.
 * Inclui uma aba extra, um aluno sem matrícula e uma matrícula duplicada,
 * para exercitar a revisão de duplicidades da importação.
 */
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";

const first = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Pedro", "Rafaela", "Samuel", "Tatiane", "Vitor"];
const last = ["Silva", "Souza", "Oliveira", "Santos", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento"];

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alunos por equipe");
  ws.addRow(["RA", "Nome Completo", "E-mail institucional", "Time", "Desafio"]);
  let n = 1;
  for (let t = 1; t <= 12; t++) {
    for (let i = 0; i < 5; i++) {
      const name = `${first[(n * 7) % first.length]} ${last[(n * 3) % last.length]} ${last[(n * 5 + 1) % last.length]}`;
      const ra = `2026${String(n).padStart(4, "0")}`;
      ws.addRow([ra, name, `${ra}@aluno.exemplo.edu`, `Equipe ${String(t).padStart(2, "0")}`, "Logística Inteligente"]);
      n++;
    }
  }
  ws.addRow(["", "Aluno Sem Matrícula", "", "Equipe 12", "Logística Inteligente"]);
  ws.getRow(1).font = { bold: true };
  const other = wb.addWorksheet("Outro desafio");
  other.addRow(["Matrícula", "Aluno", "Equipe"]);
  other.addRow(["99990001", "Pessoa Exemplo", "Equipe A"]);

  mkdirSync("samples", { recursive: true });
  await wb.xlsx.writeFile("samples/importacao-exemplo.xlsx");
  console.log("✔ samples/importacao-exemplo.xlsx");
}
main();
