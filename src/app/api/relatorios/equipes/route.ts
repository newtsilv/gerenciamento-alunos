import { NextResponse, type NextRequest } from "next/server";
import { authorizeReport, xlsxResponse } from "@/lib/reports/http";
import { addTableSheet, newWorkbook, safeFileName, toBuffer } from "@/lib/reports/excel";
import { todayISO } from "@/lib/domain/dates";

/** Exporta equipes e integrantes (atuais e histórico de participação) em Excel. */
export async function GET(request: NextRequest) {
  const challengeId = request.nextUrl.searchParams.get("desafio");
  const auth = await authorizeReport(challengeId);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const [{ data: challenge }, { data: teams }, { data: memberships }] = await Promise.all([
    supabase.from("challenges").select("name").eq("id", challengeId!).maybeSingle(),
    supabase
      .from("teams")
      .select("id, name, project_title, active, monitor:profiles!teams_assigned_monitor_id_fkey(full_name)")
      .eq("challenge_id", challengeId!)
      .order("name"),
    supabase
      .from("team_memberships")
      .select("team_id, start_date, end_date, end_reason, student:students(full_name, registration, email)")
      .eq("challenge_id", challengeId!)
      .order("start_date"),
  ]);
  if (!challenge) return NextResponse.json({ error: "Desafio não encontrado." }, { status: 404 });

  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));
  const rows = (memberships ?? [])
    .filter((m) => m.student)
    .map((m) => {
      const t = teamById.get(m.team_id);
      return {
        equipe: t?.name ?? "",
        ra: m.student!.registration ?? "",
        aluno: m.student!.full_name,
        email: m.student!.email ?? "",
        monitor: t?.monitor?.full_name ?? "",
        projeto: t?.project_title ?? "",
        entrada: m.start_date,
        saida: m.end_date ?? "",
        situacao: m.end_date ? m.end_reason ?? "Encerrado" : "Ativo",
      };
    })
    .sort((a, b) => a.equipe.localeCompare(b.equipe, "pt-BR", { numeric: true }) || a.aluno.localeCompare(b.aluno, "pt-BR"));

  const wb = newWorkbook();
  const cols = [
    { header: "Equipe", key: "equipe", width: 12 },
    { header: "RA", key: "ra", width: 12 },
    { header: "Aluno", key: "aluno", width: 40 },
    { header: "E-mail", key: "email", width: 30 },
    { header: "Monitor", key: "monitor", width: 24 },
    { header: "Projeto", key: "projeto", width: 28 },
    { header: "Entrada", key: "entrada", width: 12, date: true },
    { header: "Saída", key: "saida", width: 12, date: true },
    { header: "Situação", key: "situacao", width: 28 },
  ];
  addTableSheet(wb, "Integrantes atuais", cols, rows.filter((r) => r.situacao === "Ativo"));
  addTableSheet(wb, "Histórico de participação", cols, rows);
  const buffer = await toBuffer(wb);
  return xlsxResponse(buffer, `equipes-${safeFileName(challenge.name)}-${todayISO()}.xlsx`);
}
