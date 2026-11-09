import type { Metadata } from "next";
import { FileSpreadsheetIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportsForm } from "@/components/reports/reports-form";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage() {
  await requireViewer();
  const supabase = await createClient();
  const { data: challenges } = await supabase
    .from("challenges")
    .select("id, name, status, monitoring_sessions(session_date, team_evaluations(status))")
    .in("status", ["ativo", "encerrado", "planejado"])
    .order("name");

  const list = (challenges ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sessions: c.monitoring_sessions
      .map((s) => ({ date: s.session_date, done: s.team_evaluations.filter((e) => e.status === "concluida").length }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  }));

  return (
    <PageContainer>
      <PageHeader title="Relatórios" description="Planilhas Excel geradas a partir dos dados registrados, prontas para a coordenação." />
      {list.length === 0 ? (
        <EmptyState icon={FileSpreadsheetIcon} title="Nenhum desafio disponível" />
      ) : (
        <ReportsForm challenges={list} today={todayISO()} />
      )}
    </PageContainer>
  );
}
