/**
 * Fluxo principal (requer Supabase local + `npm run seed:dev` + `npm run sample:xlsx`):
 * login → criar desafio → importar planilha → transferir aluno → avaliar equipe →
 * histórico → dashboard → relatórios diário e semanal.
 */
import { expect, test } from "@playwright/test";
import ExcelJS from "exceljs";
import path from "node:path";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const shift = (days: number) => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

let createdChallengeUrl: string | null = null;

// O teste sempre exclui o desafio que criou (inclusive se falhar no meio)
test.afterEach(async ({ page }) => {
  if (!createdChallengeUrl) return;
  await page.goto(`${createdChallengeUrl}/configuracoes`);
  await page.getByRole("button", { name: "Excluir desafio" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page).toHaveURL(/\/desafios$/);
  createdChallengeUrl = null;
});

test("fluxo completo do monitor/administrador", async ({ page }) => {
  const name = `Desafio E2E ${Date.now()}`;

  // 1. Login com RA
  await page.goto("/login");
  await page.getByLabel("RA").fill("admin01");
  await page.getByLabel("Senha").fill("teste123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // 2. Criar desafio
  await page.goto("/desafios");
  await page.getByRole("button", { name: "Novo desafio" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome do desafio").fill(name);
  await dialog.getByLabel("Empresa parceira").fill("Empresa E2E");
  await dialog.getByLabel("Status").selectOption("ativo");
  await dialog.getByLabel("Data de início").fill(shift(-14));
  await dialog.getByLabel("Data de encerramento").fill(shift(30));
  await dialog.getByRole("button", { name: "Criar desafio" }).click();
  await expect(page).toHaveURL(/\/desafios\/[0-9a-f-]{36}$/);
  const challengeUrl = page.url();
  createdChallengeUrl = challengeUrl;
  const challengeId = challengeUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // 3. Importar planilha
  await page.goto(`${challengeUrl}/equipes/importar`);
  await page.locator('input[type="file"]').setInputFiles(path.resolve("samples/importacao-exemplo.xlsx"));
  await expect(page.getByRole("button", { name: /Alunos por equipe/ })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Mapeie as colunas")).toBeVisible();
  await page.getByRole("button", { name: "Analisar dados" }).click();
  await expect(page.getByText("Registros válidos")).toBeVisible();
  // Em reexecuções o aluno sem matrícula já existe: a duplicidade exige decisão manual
  const duplicate = page.getByRole("combobox", { name: "Decisão sobre duplicidade" });
  if (await duplicate.count()) {
    await expect(page.getByRole("button", { name: /Revise \d+ duplicidade/ })).toBeDisabled();
    for (const d of await duplicate.all()) await d.selectOption({ index: 2 }); // "Mesmo aluno: …"
  }
  const importButton = page.getByRole("button", { name: /^Importar \d+ registro/ });
  await expect(importButton).toBeEnabled();
  await importButton.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Importar" }).click();
  await expect(page.getByText("Importação concluída").first()).toBeVisible();

  // 4. Equipes importadas + transferência
  await page.goto(`${challengeUrl}/equipes`);
  const team01 = page.locator("article", { has: page.getByRole("link", { name: "Equipe 01" }) });
  await expect(team01).toBeVisible();
  const firstMember = team01.locator("li").first();
  const studentName = (await firstMember.locator("p").first().textContent())!.trim();
  await firstMember.getByRole("button", { name: `Ações para ${studentName}` }).click();
  await page.getByRole("menuitem", { name: "Transferir" }).click();
  await page.getByRole("dialog").getByLabel("Equipe de destino").selectOption({ label: "Equipe 04" });
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar transferência" }).click();
  await expect(page.getByText(/Aluno transferido/)).toBeVisible();
  const team04 = page.locator("article", { has: page.getByRole("link", { name: "Equipe 04" }) });
  await expect(team04.getByText(studentName)).toBeVisible();

  // 5. Escolha livre do dia: abre "Ontem" (dia anterior, possivelmente fora do calendário)
  await page.getByRole("link", { name: "Acompanhar" }).click();
  await expect(page.getByRole("heading", { name: "Qual dia você vai registrar?" })).toBeVisible();
  await page.getByRole("button", { name: /^Ontem/ }).click();
  await expect(page).toHaveURL(/acompanhamentos\/[0-9a-f-]{36}$/);
  await page.getByRole("combobox", { name: "Equipes exibidas" }).selectOption("all");
  // alunos importados constam desde o início do desafio, então aparecem em dias anteriores
  await expect(page.getByRole("link", { name: /Equipe 03/ })).not.toContainText("0 integrante");
  await page.getByRole("link", { name: "Voltar" }).click(); // volta para a escolha do dia
  await expect(page).toHaveURL(challengeUrl);
  await page.getByRole("button", { name: /^Hoje/ }).click();
  await expect(page).toHaveURL(/acompanhamentos\/[0-9a-f-]{36}$/);
  await page.getByRole("combobox", { name: "Equipes exibidas" }).selectOption("all");
  await page.getByRole("link", { name: /Equipe 02/ }).click();

  // 6. Avaliação coletiva + individual
  await expect(page.getByRole("heading", { name: "Avaliação coletiva" })).toBeVisible();
  for (const [criterion, score] of [
    ["Organização", "4"],
    ["Comunicação", "3"],
    ["Colaboração", "5"],
    ["Cumprimento das atividades", "4"],
    ["Evolução do projeto", "3"],
  ]) {
    await page.getByRole("radiogroup", { name: criterion }).getByRole("radio", { name: score }).click();
  }
  await page.getByRole("radiogroup", { name: "Autonomia na resolução de problemas" }).getByRole("radio", { name: "N/O" }).click();
  await page.getByLabel("Quais dificuldades foram encontradas?").fill("Integração com a API de pagamentos.");
  await page.getByLabel("O que precisa ser feito até o próximo acompanhamento?").fill("Finalizar o protótipo.");
  for (const c of ["Participação", "Comunicação", "Colaboração", "Evolução técnica", "Autonomia", "Cumprimento das atividades"]) {
    await page.getByLabel(`Aplicar nota a todos em ${c}`).selectOption("4");
  }
  await page.getByRole("combobox", { name: "Situação de acompanhamento" }).first().selectOption("precisa_atencao");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo.")).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByText("Acompanhamento concluído.")).toBeVisible();

  await expect(page.getByText("5/5 alunos avaliados")).toBeVisible();

  // Planilha do dia direto na lista de dias
  await page.goto(challengeUrl);
  const downloadDone = page.waitForResponse((r) => r.url().includes("/api/relatorios/diario") && r.status() === 200);
  await page.getByRole("button", { name: "Baixar planilha" }).first().click();
  await downloadDone;

  // 7. Histórico
  await page.goto(`${challengeUrl}/historico`);
  await expect(page.getByRole("cell", { name: "Equipe 02" })).toBeVisible();

  // 8. Dashboard
  await page.goto(challengeUrl);
  await expect(page.getByRole("heading", { name: "Qual dia você vai registrar?" })).toBeVisible();
  await page.getByRole("link", { name: "Resultados" }).click();
  await expect(page.getByText("Equipes com dificuldades")).toBeVisible();
  await page.getByRole("link", { name: "Ver histórico" }).click();
  await expect(page.getByRole("cell", { name: "Equipe 02" })).toBeVisible();

  // "Voltar" retorna à tela anterior (Histórico → Resultados → Acompanhar)
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/resultados$/);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(challengeUrl);
  // Equipes → detalhe da equipe → Voltar → Equipes
  await page.getByRole("link", { name: "Equipes", exact: true }).click();
  await page.getByRole("link", { name: "Equipe 02" }).click();
  await expect(page).toHaveURL(/\/equipes\/[0-9a-f-]{36}$/);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/equipes$/);
  // Link aberto direto em outra aba: "Voltar" vai para a tela pai
  const direct = await page.context().newPage();
  await direct.goto(`${challengeUrl}/historico`);
  await direct.getByRole("link", { name: "Voltar" }).click();
  await expect(direct).toHaveURL(/\/resultados$/);
  await direct.close();
  await page.goto("/dashboard");
  await expect(page.getByText("Previstos", { exact: true })).toBeVisible();

  // 9. Relatórios Excel reais
  for (const [url, sheets] of [
    [`/api/relatorios/diario?desafio=${challengeId}&data=${today}`, ["Resumo", "Equipes", "Alunos", "Pendências"]],
    [`/api/relatorios/semanal?desafio=${challengeId}&semana=${today}`, ["Resumo", "Equipes", "Alunos", "Pendências"]],
  ] as const) {
    const res = await page.request.get(url);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.body()) as never);
    const names = wb.worksheets.map((w) => w.name);
    for (const s of sheets) expect(names).toContain(s);
  }

  // Aluno transferido: avaliação histórica continua na equipe original? (avaliou Equipe 02; transferido 01→04)
  const daily = await page.request.get(`/api/relatorios/diario?desafio=${challengeId}&data=${today}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await daily.body()) as never);
  const ind = wb.getWorksheet("Alunos")!;
  const rows: string[] = [];
  ind.eachRow((r) => rows.push(String(r.getCell(1).value) + "|" + String(r.getCell(2).value)));
  expect(rows).toContain(`${studentName}|Equipe 04`);
});
