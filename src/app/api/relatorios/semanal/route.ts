import { NextResponse, type NextRequest } from "next/server";
import { authorizeReport, xlsxResponse } from "@/lib/reports/http";
import { loadReportData } from "@/lib/reports/data";
import { buildWeeklyWorkbook } from "@/lib/reports/weekly";
import { safeFileName, toBuffer } from "@/lib/reports/excel";
import { isISODate, weekRange } from "@/lib/domain/dates";

export async function GET(request: NextRequest) {
  const challengeId = request.nextUrl.searchParams.get("desafio");
  const ref = request.nextUrl.searchParams.get("semana");
  if (!isISODate(ref)) return NextResponse.json({ error: "Semana inválida." }, { status: 400 });

  const auth = await authorizeReport(challengeId);
  if ("error" in auth) return auth.error;

  const range = weekRange(ref);
  try {
    const data = await loadReportData(auth.supabase, challengeId!, range.start, range.end);
    if (!data) return NextResponse.json({ error: "Desafio não encontrado." }, { status: 404 });
    const buffer = await toBuffer(buildWeeklyWorkbook(data, range));
    await auth.supabase.from("reports").insert({
      challenge_id: challengeId!,
      type: "semanal",
      period_start: range.start,
      period_end: range.end,
      generated_by: auth.viewer.id,
    });
    return xlsxResponse(buffer, `relatorio-semanal-${safeFileName(data.challenge.name)}-${range.start}.xlsx`);
  } catch (e) {
    console.error("relatório semanal", e);
    return NextResponse.json({ error: "Falha ao gerar o relatório." }, { status: 500 });
  }
}
