import { Stagger } from "@/components/shared/motion";
import Link from "next/link";
import { Panel } from "@/components/dashboard/widgets";
import { MilestonesManager } from "@/components/deliverables/milestones-manager";
import { requireChallengeAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DELIVERABLE_STATUS, type DeliverableStatus } from "@/lib/domain/constants";
import { todayISO } from "@/lib/domain/dates";
import { cn } from "@/lib/utils";

const cellClass: Record<DeliverableStatus, string> = {
  concluida: "bg-success-soft text-success border-success/20",
  em_andamento: "bg-brand-soft text-brand border-brand/20",
  bloqueada: "bg-danger-soft text-danger border-danger/20",
  nao_iniciada: "bg-surface text-muted-foreground",
};
const short: Record<DeliverableStatus, string> = { concluida: "Concluída", em_andamento: "Andamento", bloqueada: "Bloqueada", nao_iniciada: "—" };

export default async function DeliverablesPage({ params }: PageProps<"/desafios/[id]/entregas">) {
  const { id } = await params;
  const access = await requireChallengeAccess(id);
  const supabase = await createClient();
  const [{ data: milestones }, { data: teams }] = await Promise.all([
    supabase.from("project_milestones").select("id, title, description, due_date, position").eq("challenge_id", id).order("position").order("created_at"),
    supabase
      .from("teams")
      .select("id, name, team_deliverables(id, milestone_id, title, status, due_date)")
      .eq("challenge_id", id)
      .eq("active", true)
      .order("name"),
  ]);
  const ms = milestones ?? [];
  const today = todayISO();

  return (
    <Stagger className="grid gap-6 xl:grid-cols-[340px_1fr]">
      {access.canManage ? (
        <Panel title="Marcos do desafio" description="Personalizáveis por desafio.">
          <MilestonesManager challengeId={id} milestones={ms} />
        </Panel>
      ) : (
        <Panel title="Marcos do desafio">
          <ol className="list-decimal pl-5 text-sm">
            {ms.map((m) => (
              <li key={m.id} className="py-1">
                {m.title}
              </li>
            ))}
          </ol>
        </Panel>
      )}
      <Panel title="Progresso por equipe" description="Clique na equipe para atualizar as entregas.">
        {!teams?.length || !ms.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cadastre equipes e marcos para acompanhar o progresso.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card px-2 py-1 text-left font-medium">Equipe</th>
                  {ms.map((m) => (
                    <th key={m.id} className="min-w-24 px-1 py-1 text-center font-medium" title={m.title}>
                      <span className="line-clamp-2">{m.title}</span>
                    </th>
                  ))}
                  <th className="px-2 py-1 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => {
                  const byMilestone = new Map(t.team_deliverables.map((d) => [d.milestone_id, d]));
                  const total = t.team_deliverables.length;
                  const done = t.team_deliverables.filter((d) => d.status === "concluida").length;
                  return (
                    <tr key={t.id}>
                      <td className="sticky left-0 bg-card px-2 py-1 text-sm whitespace-nowrap">
                        <Link href={`/desafios/${id}/equipes/${t.id}`} className="hover:text-brand">
                          {t.name}
                        </Link>
                      </td>
                      {ms.map((m) => {
                        const d = byMilestone.get(m.id);
                        if (!d) return <td key={m.id} />;
                        const late = d.status !== "concluida" && d.due_date && d.due_date < today;
                        return (
                          <td
                            key={m.id}
                            title={`${m.title}: ${DELIVERABLE_STATUS[d.status]}${late ? " (atrasada)" : ""}`}
                            className={cn("rounded-md border px-1 py-1.5 text-center", cellClass[d.status], late && "ring-1 ring-danger/50")}
                          >
                            {short[d.status]}
                          </td>
                        );
                      })}
                      <td className="px-2 text-center font-medium tabular-nums">{total ? Math.round((done / total) * 100) : 0}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">Borda vermelha: prazo vencido e entrega não concluída.</p>
          </div>
        )}
      </Panel>
    </Stagger>
  );
}
