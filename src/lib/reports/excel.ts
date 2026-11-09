import ExcelJS from "exceljs";
import { parseISO } from "date-fns";

/**
 * Estilo das planilhas: visual de "tabela" moderna (rótulo acima do cabeçalho,
 * cabeçalho escuro, linhas espaçadas e zebradas, status como "pílulas" coloridas,
 * pessoas como etiquetas cinza) e sem linhas de grade.
 */

export const COLORS = {
  brand: "FF0747DE",
  navy: "FF0B2545",
  headerText: "FFFFFFFF",
  text: "FF1F2937",
  muted: "FF8A9099",
  zebra: "FFF7F8FA",
  white: "FFFFFFFF",
  rule: "FFE3E6EB",
  outline: "FFC9D3E3",
};

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "muted";

const TONES: Record<Tone, { fill: string; font: string }> = {
  success: { fill: "FFDDF3E4", font: "FF0B7A35" },
  warning: { fill: "FFFDF1C7", font: "FF8A5A00" },
  danger: { fill: "FFFDE2DF", font: "FFB42318" },
  info: { fill: "FFDCE6FD", font: "FF0747DE" },
  neutral: { fill: "FFECEEF2", font: "FF374151" },
  muted: { fill: "FFF2F3F5", font: "FF8A9099" },
};

export type Column = {
  header: string;
  key: string;
  width: number;
  /** text (padrão) · center · date · number (nota/média) · delta (variação ▲▼) · pill (status) · person (etiqueta) · wrap (texto longo) */
  kind?: "text" | "center" | "date" | "number" | "delta" | "pill" | "person" | "wrap";
  /** Para pílulas: cor de cada valor. */
  tone?: (value: unknown) => Tone | null;
  /** Para pílulas: lista de valores possíveis (vira menu suspenso no Excel/Google Sheets). */
  options?: string[];
  bold?: boolean;
};

export function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Acompanha — Desafios";
  wb.created = new Date();
  return wb;
}

/** Cria uma aba com título, subtítulo e sem grade. Retorna a próxima linha livre. */
export function newSheet(wb: ExcelJS.Workbook, name: string, title: string, subtitle?: string) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }], properties: { defaultRowHeight: 20 } });
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { bold: true, size: 16, color: { argb: COLORS.navy } };
  ws.getRow(1).height = 28;
  if (subtitle) {
    const s = ws.getCell(2, 1);
    s.value = subtitle;
    s.font = { size: 10, color: { argb: COLORS.muted } };
  }
  return { ws, next: subtitle ? 4 : 3 };
}

/** Estima a altura para textos quebrados (o Excel não ajusta sozinho quando há altura definida). */
function estimateLines(text: string, width: number) {
  const perLine = Math.max(8, Math.floor(width * 1.15));
  return text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

/**
 * Desenha uma tabela a partir da linha `startRow`: rótulo (chip) + cabeçalho + linhas.
 * Retorna a linha do cabeçalho e a próxima linha livre (com uma linha de respiro).
 */
export function addTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  label: string,
  columns: Column[],
  rows: Record<string, unknown>[],
  opts: { freeze?: boolean; filter?: boolean; emptyText?: string } = {},
) {
  // larguras (a maior largura pedida vence quando há várias tabelas na mesma aba)
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.max(col.width ?? 0, c.width);
  });

  // rótulo da tabela, como uma "aba" acima do cabeçalho
  const chipRow = ws.getRow(startRow);
  chipRow.height = 24;
  const chip = chipRow.getCell(1);
  chip.value = label;
  chip.font = { bold: true, size: 11, color: { argb: COLORS.headerText } };
  chip.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
  chip.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

  // cabeçalho
  const headerRowNumber = startRow + 1;
  const header = ws.getRow(headerRowNumber);
  header.height = 28;
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navy } };
    const centered = c.kind === "center" || c.kind === "number" || c.kind === "delta" || c.kind === "pill" || c.kind === "date";
    cell.alignment = { vertical: "middle", horizontal: centered ? "center" : "left", indent: centered ? 0 : 1, wrapText: true };
  });

  const data = rows.length ? rows : [{ [columns[0].key]: opts.emptyText ?? "Nada para mostrar." }];
  data.forEach((r, idx) => {
    const row = ws.getRow(headerRowNumber + 1 + idx);
    const bg = idx % 2 === 1 ? COLORS.zebra : COLORS.white;
    let lines = 1;
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = r[c.key];
      const gap = { style: "thick" as const, color: { argb: bg } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { color: { argb: COLORS.text }, bold: c.bold };
      cell.border = { bottom: { style: "thin", color: { argb: COLORS.rule } } };
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

      if (!rows.length) {
        cell.value = i === 0 ? (v as string) : "";
        cell.font = { italic: true, color: { argb: COLORS.muted } };
        return;
      }

      if (c.kind === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        cell.value = parseISO(v);
        cell.numFmt = "dd/mm/yyyy";
        cell.alignment = { vertical: "middle", horizontal: "center" };
        return;
      }
      cell.value = (v ?? "") as ExcelJS.CellValue;
      if (c.kind === "center") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        return;
      }

      if (c.kind === "number" || c.kind === "delta") {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        if (typeof v === "number") {
          cell.numFmt = c.kind === "delta" ? '"▲ "0.0;"▼ "0.0;"= "0.0' : Number.isInteger(v) ? "0" : "0.0";
          const color =
            c.kind === "delta" ? (v > 0 ? TONES.success.font : v < 0 ? TONES.danger.font : COLORS.muted) : v >= 8 ? TONES.success.font : v < 5 ? TONES.danger.font : COLORS.text;
          cell.font = { bold: c.bold || c.kind === "delta", color: { argb: color } };
        } else if (v) {
          cell.font = { italic: true, color: { argb: COLORS.muted } };
        }
        return;
      }

      if ((c.kind === "pill" || c.kind === "person") && v) {
        const tone = c.kind === "person" ? "neutral" : (c.tone?.(v) ?? "neutral");
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TONES[tone].fill } };
        cell.font = { bold: c.kind === "pill", color: { argb: TONES[tone].font }, italic: tone === "muted" };
        cell.border = { top: gap, bottom: gap, left: gap, right: gap };
        cell.alignment = { vertical: "middle", horizontal: c.kind === "pill" ? "center" : "left", indent: c.kind === "pill" ? 0 : 1 };
        if (c.kind === "pill" && c.options?.length) {
          cell.dataValidation = { type: "list", allowBlank: true, formulae: [`"${c.options.join(",")}"`], showErrorMessage: false };
        }
        return;
      }

      if (c.kind === "wrap" && typeof v === "string" && v) {
        cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
        lines = Math.max(lines, estimateLines(v, c.width));
      }
    });
    row.height = Math.max(24, lines * 15 + 8);
  });

  // contorno discreto da tabela
  const last = headerRowNumber + data.length;
  for (let r = headerRowNumber + 1; r <= last; r++) {
    const first = ws.getRow(r).getCell(1);
    first.border = { ...first.border, left: { style: "thin", color: { argb: COLORS.outline } } };
    const end = ws.getRow(r).getCell(columns.length);
    end.border = { ...end.border, right: { style: "thin", color: { argb: COLORS.outline } } };
  }
  columns.forEach((_, i) => {
    const cell = ws.getRow(last).getCell(i + 1);
    cell.border = { ...cell.border, bottom: { style: "thin", color: { argb: COLORS.outline } } };
  });

  if (opts.freeze) ws.views = [{ state: "frozen", ySplit: headerRowNumber, showGridLines: false }];
  if (opts.filter && rows.length) {
    ws.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: last, column: columns.length } };
  }
  return { headerRowNumber, next: last + 3 };
}

/** Nota de rodapé em cinza, abaixo das tabelas. */
export function addNote(ws: ExcelJS.Worksheet, row: number, text: string) {
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = { italic: true, size: 9, color: { argb: COLORS.muted } };
  return row + 2;
}

export async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

export function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
}
