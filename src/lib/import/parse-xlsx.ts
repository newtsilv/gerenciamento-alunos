import "server-only";
import ExcelJS from "exceljs";

export type ParsedSheet = {
  name: string;
  headers: string[];
  rows: { rowNumber: number; cells: string[] }[];
  totalRows: number;
};

const MAX_ROWS = 5000;

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return String(v.result ?? ""); // fórmula
    if ("hyperlink" in v) return String((v as { hyperlink: string }).hyperlink).replace(/^mailto:/, "");
  }
  return String(cell.text ?? v).trim();
}

/** Lê todas as abas. A primeira linha não vazia de cada aba é tratada como cabeçalho. */
export async function parseWorkbook(buffer: ArrayBuffer): Promise<ParsedSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return workbook.worksheets
    .filter((ws) => ws.state === "visible" || !ws.state)
    .map((ws) => {
      const all: { rowNumber: number; cells: string[] }[] = [];
      ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cells: string[] = [];
        for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c)).trim());
        if (cells.some(Boolean)) all.push({ rowNumber, cells });
      });

      const [header, ...rest] = all;
      const headers = (header?.cells ?? []).map((h, i) => h || `Coluna ${i + 1}`);
      // remove colunas totalmente vazias no fim
      while (headers.length && headers[headers.length - 1].startsWith("Coluna ") && rest.every((r) => !r.cells[headers.length - 1])) {
        headers.pop();
      }
      return {
        name: ws.name,
        headers,
        rows: rest.slice(0, MAX_ROWS).map((r) => ({ rowNumber: r.rowNumber, cells: r.cells.slice(0, headers.length) })),
        totalRows: rest.length,
      };
    });
}
