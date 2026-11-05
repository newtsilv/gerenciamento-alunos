import ExcelJS from "exceljs";
import { parseISO } from "date-fns";

/** Utilitários de formatação compartilhados pelos relatórios. */

export const COLORS = {
  brand: "FF0747DE",
  navy: "FF002C57",
  headerText: "FFFFFFFF",
  zebra: "FFF6F6F6",
  border: "FFE6E6E6",
  muted: "FF919192",
  successSoft: "FFEBFBEE",
  success: "FF05842B",
  warningSoft: "FFFFF3E7",
  warning: "FFB87700",
  dangerSoft: "FFFFEEEA",
  danger: "FFBA2F2A",
  notEvaluated: "FFF2F2F2",
};

export type ColumnSpec = { header: string; key: string; width: number; date?: boolean; number?: boolean; wrap?: boolean };

export function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Acompanha — Desafios";
  wb.created = new Date();
  return wb;
}

/** Cria uma aba de tabela com cabeçalho formatado, filtros, congelamento e larguras. */
export function addTableSheet(wb: ExcelJS.Workbook, name: string, columns: ColumnSpec[], rows: Record<string, unknown>[], opts: { startRow?: number; title?: string } = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: opts.title ? 3 : 1 }] });
  let headerRowNumber = 1;
  if (opts.title) {
    ws.mergeCells(1, 1, 1, Math.max(columns.length, 1));
    const t = ws.getCell(1, 1);
    t.value = opts.title;
    t.font = { bold: true, size: 13, color: { argb: COLORS.navy } };
    headerRowNumber = 3;
  }
  ws.columns = columns.map((c) => ({ key: c.key, width: c.width }));
  const header = ws.getRow(headerRowNumber);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: COLORS.headerText } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: COLORS.navy } } };
  });
  header.height = 30;

  rows.forEach((r, idx) => {
    const row = ws.getRow(headerRowNumber + 1 + idx);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = r[c.key];
      if (c.date && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        cell.value = parseISO(v);
        cell.numFmt = "dd/mm/yyyy";
      } else {
        cell.value = (v ?? "") as ExcelJS.CellValue;
      }
      if (c.number && typeof v === "number") cell.numFmt = Number.isInteger(v) ? "0" : "0.0";
      cell.alignment = { vertical: "top", wrapText: c.wrap ?? false, horizontal: c.number ? "center" : undefined };
      cell.border = { bottom: { style: "hair", color: { argb: COLORS.border } } };
      if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.zebra } };
    });
  });

  if (columns.length) {
    ws.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber + Math.max(rows.length, 0), column: columns.length },
    };
  }
  return { ws, headerRowNumber };
}

export function fillRow(row: ExcelJS.Row, argb: string, fromCol = 1, toCol?: number) {
  const last = toCol ?? row.cellCount;
  for (let c = fromCol; c <= last; c++) {
    row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  }
}

export function highlightCell(cell: ExcelJS.Cell, tone: "success" | "warning" | "danger" | "muted") {
  const map = {
    success: [COLORS.successSoft, COLORS.success],
    warning: [COLORS.warningSoft, COLORS.warning],
    danger: [COLORS.dangerSoft, COLORS.danger],
    muted: [COLORS.notEvaluated, COLORS.muted],
  } as const;
  const [bg, fg] = map[tone];
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
  cell.font = { ...(cell.font ?? {}), color: { argb: fg }, bold: tone !== "muted" };
}

/** Aba no formato "chave: valor" para resumos. */
export function addSummarySheet(wb: ExcelJS.Workbook, name: string, title: string, sections: { heading: string; items: [string, string | number, ("success" | "warning" | "danger" | "muted")?][] }[]) {
  const ws = wb.addWorksheet(name);
  ws.columns = [{ width: 44 }, { width: 60 }];
  ws.mergeCells("A1:B1");
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { bold: true, size: 15, color: { argb: COLORS.navy } };
  let r = 3;
  for (const s of sections) {
    ws.mergeCells(r, 1, r, 2);
    const h = ws.getCell(r, 1);
    h.value = s.heading;
    h.font = { bold: true, color: { argb: COLORS.headerText } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
    r++;
    for (const [label, value, tone] of s.items) {
      const row = ws.getRow(r);
      row.getCell(1).value = label;
      row.getCell(1).font = { color: { argb: COLORS.navy } };
      const vc = row.getCell(2);
      vc.value = value;
      vc.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
      if (tone) highlightCell(vc, tone);
      row.getCell(1).border = { bottom: { style: "hair", color: { argb: COLORS.border } } };
      vc.border = { bottom: { style: "hair", color: { argb: COLORS.border } } };
      r++;
    }
    r++;
  }
  return ws;
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
