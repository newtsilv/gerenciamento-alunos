import { NextResponse, type NextRequest } from "next/server";
import { authorizeReport, xlsxResponse } from "@/lib/reports/http";
import { loadReportData } from "@/lib/reports/data";
import { buildDailyWorkbook } from "@/lib/reports/daily";
import { safeFileName, toBuffer } from "@/lib/reports/excel";
import { isISODate } from "@/lib/domain/dates";

export async function GET(request: NextRequest) {
  const challengeId = request.nextUrl.searchParams.get("desafio");
  const date = request.nextUrl.searchParams.get("data");
  if (!isISODate(date)) return NextResponse.json({ error: "Data inválida." }, { status: 400 });

  const auth = await authorizeReport(challengeId);
  if ("error" in auth) return auth.error;

  try {
    const data = await loadReportData(auth.supabase, challengeId!, date, date);
    if (!data) return NextResponse.json({ error: "Desafio não encontrado." }, { status: 404 });
    const buffer = await toBuffer(buildDailyWorkbook(data, date));
    await auth.supabase.from("reports").insert({
      challenge_id: challengeId!,
      type: "diario",
      period_start: date,
      period_end: date,
      generated_by: auth.viewer.id,
    });
    return xlsxResponse(buffer, `relatorio-diario-${safeFileName(data.challenge.name)}-${date}.xlsx`);
  } catch (e) {
    console.error("relatório diário", e);
    return NextResponse.json({ error: "Falha ao gerar o relatório." }, { status: 500 });
  }
}
