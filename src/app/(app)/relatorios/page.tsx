import type { Metadata } from "next";
import { FileSpreadsheetIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportsForm } from "@/components/reports/reports-form";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, todayISO } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage() {
  await requireViewer();
  const supabase = await createClient();
  const [{ data: challenges }, { data: recent }] = await Promise.all([
    supabase
      .from("challenges")
      .select("id, name, status, monitoring_sessions(session_date, team_evaluations(status))")
      .in("status", ["ativo", "encerrado", "planejado"])
      .order("name"),
    supabase
      .from("reports")
      .select("id, type, period_start, period_end, created_at, challenge:challenges(name), author:profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

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
      {!!recent?.length && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Gerados recentemente</h2>
          <ul className="divide-y rounded-2xl border bg-card text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-2.5">
                <span>
                  {r.type === "diario" ? "Diário" : "Semanal"} · {r.challenge?.name} ·{" "}
                  {r.type === "diario" ? formatDate(r.period_start) : `${formatDate(r.period_start)} a ${formatDate(r.period_end)}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.author?.full_name} · {formatDateTime(r.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
