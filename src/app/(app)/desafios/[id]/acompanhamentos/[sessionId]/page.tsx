import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/reports/download-button";
import { SessionTeams } from "@/components/sessions/session-teams";
import { requireChallengeAccess } from "@/lib/auth";
import { loadSessionTeams } from "@/lib/data/sessions";
import { formatDate, todayISO } from "@/lib/domain/dates";
import { StatusBadge } from "@/components/shared/status-badge";

export default async function SessionPage({ params }: PageProps<"/desafios/[id]/acompanhamentos/[sessionId]">) {
  const { id, sessionId } = await params;
  const access = await requireChallengeAccess(id);
  const data = await loadSessionTeams(sessionId, id);
  if (!data) notFound();
  const isToday = data.session.session_date === todayISO();

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold capitalize">{formatDate(data.session.session_date, "EEEE, dd 'de' MMMM")}</h2>
          {isToday && <StatusBadge tone="info">Hoje</StatusBadge>}
          {data.session.is_extra && <StatusBadge>Fora do calendário</StatusBadge>}
        </div>
        <DownloadButton href={`/api/relatorios/diario?desafio=${id}&data=${data.session.session_date}`} label="Baixar planilha do dia" variant="outline" />
      </div>
      <SessionTeams
        baseHref={`/desafios/${id}/acompanhamentos/${sessionId}`}
        teams={data.teams}
        viewerId={access.viewer.id}
        isMonitor={access.roles.includes("monitor")}
      />
    </div>
  );
}
