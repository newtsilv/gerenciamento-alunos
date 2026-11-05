"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRightLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  ShuffleIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/native-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toastResult } from "@/components/shared/toast-result";
import { MembersDialog } from "@/components/challenges/members-dialog";
import type { MembersManagerProps } from "@/components/challenges/members-manager";
import { assignMonitor, deleteTeam, distributeTeams, reactivateTeam } from "@/lib/actions/teams";
import { TeamDialog } from "./team-dialog";
import { AddStudentDialog } from "./add-student-dialog";
import { TransferDialog, type TransferTarget } from "./transfer-dialog";
import { RemoveMemberDialog, type RemoveTarget } from "./remove-member-dialog";

type Member = { membershipId: string; id: string; full_name: string; registration: string | null; email: string | null; startDate: string };
export type BoardTeam = {
  id: string;
  name: string;
  project_title: string;
  description: string;
  active: boolean;
  assigned_monitor_id: string | null;
  members: Member[];
};

export function TeamsBoard({
  challengeId,
  teams,
  monitors,
  members,
  people,
  canManage,
  viewerId,
  challengeStartDate,
}: {
  challengeStartDate: string;
  challengeId: string;
  teams: BoardTeam[];
  monitors: { id: string; name: string }[];
  members: MembersManagerProps["members"];
  people: MembersManagerProps["people"];
  canManage: boolean;
  viewerId: string;
}) {
  const [query, setQuery] = useState("");
  // Só abre filtrado em "minhas equipes" se o usuário realmente tiver equipes atribuídas
  const [monitorFilter, setMonitorFilter] = useState(teams.some((t) => t.active && t.assigned_monitor_id === viewerId) ? viewerId : "");
  const [showInactive, setShowInactive] = useState(false);
  const [transfer, setTransfer] = useState<TransferTarget | null>(null);
  const [remove, setRemove] = useState<RemoveTarget | null>(null);
  const [editing, setEditing] = useState<BoardTeam | null>(null);
  const [deleting, setDeleting] = useState<BoardTeam | null>(null);
  const [pending, startTransition] = useTransition();

  const monitorName = (id: string | null) => monitors.find((m) => m.id === id)?.name;
  const activeTeams = teams.filter((t) => t.active);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter((t) => {
      if (!showInactive && !t.active) return false;
      if (monitorFilter === "none" && t.assigned_monitor_id) return false;
      if (monitorFilter && monitorFilter !== "none" && t.assigned_monitor_id !== monitorFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.project_title.toLowerCase().includes(q) ||
        t.members.some((m) => m.full_name.toLowerCase().includes(q) || m.registration?.toLowerCase().includes(q))
      );
    });
  }, [teams, query, monitorFilter, showInactive]);

  const totalStudents = activeTeams.reduce((n, t) => n + t.members.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {canManage && monitors.length === 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            <strong>Nenhum monitor vinculado a este desafio.</strong> Vincule as pessoas como <em>Monitor</em> para escolher quem acompanha cada equipe.
          </p>
          <MembersDialog challengeId={challengeId} members={members} people={people} trigger={<Button size="sm" className="shrink-0" />} label="Vincular monitores" />
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_200px] lg:max-w-2xl">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar equipe, aluno ou matrícula…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              aria-label="Buscar"
            />
          </div>
          <NativeSelect value={monitorFilter} onChange={(e) => setMonitorFilter(e.target.value)} aria-label="Filtrar por monitor">
            <option value="">Todos os monitores</option>
            <option value="none">Sem monitor</option>
            {monitors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === viewerId ? `${m.name} (você)` : m.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 lg:shrink-0">
            <MembersDialog challengeId={challengeId} members={members} people={people} label="Monitores" />
            <Button
              variant="outline"
              disabled={pending || monitors.length === 0}
              onClick={() => startTransition(async () => void toastResult(await distributeTeams(challengeId)))}
            >
              <ShuffleIcon />
              Distribuir
            </Button>
            <Button variant="outline" render={<Link href={`/desafios/${challengeId}/equipes/importar`} />}>
              Importar planilha
            </Button>
            <TeamDialog challengeId={challengeId} monitors={monitors} trigger={<Button>Nova equipe</Button>} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {activeTeams.length} equipe(s) ativa(s) · {totalStudents} aluno(s)
          {filtered.length !== (showInactive ? teams.length : activeTeams.length) && ` · exibindo ${filtered.length}`}
        </span>
        {teams.some((t) => !t.active) && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-[var(--brand)]" />
            Mostrar equipes desativadas
          </label>
        )}
      </div>

      {teams.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Nenhuma equipe cadastrada"
          description="Cadastre equipes manualmente ou importe uma planilha com equipes e alunos."
          action={
            canManage ? (
              <Button render={<Link href={`/desafios/${challengeId}/equipes/importar`} />}>Importar planilha</Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={SearchIcon}
          title="Nenhuma equipe encontrada"
          description="Nenhuma equipe corresponde à busca ou aos filtros atuais."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setMonitorFilter("");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((team, i) => (
            <article
              key={team.id}
              style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
              className="flex animate-fade-up flex-col rounded-2xl border bg-card"
            >
              <header className="flex items-start justify-between gap-2 border-b p-4">
                <div className="min-w-0">
                  <Link href={`/desafios/${challengeId}/equipes/${team.id}`} className="group inline-flex items-center gap-1 font-semibold hover:text-brand">
                    {team.name}
                    <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  {team.project_title && <p className="truncate text-sm text-muted-foreground">{team.project_title}</p>}
                  {!team.active && <StatusBadge className="mt-1">Desativada</StatusBadge>}
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ações da equipe" />}>
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setEditing(team)}>
                        <PencilIcon /> Editar equipe
                      </DropdownMenuItem>
                      {!team.active ? (
                        <DropdownMenuItem onClick={() => startTransition(async () => void toastResult(await reactivateTeam(challengeId, team.id)))}>
                          Reativar equipe
                        </DropdownMenuItem>
                      ) : (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(team)}>
                            <Trash2Icon /> Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </header>

              <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Monitor:</span>
                {canManage ? (
                  <NativeSelect
                    value={team.assigned_monitor_id ?? ""}
                    wrapperClassName="flex-1"
                    className="h-8"
                    aria-label={`Monitor da ${team.name}`}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      startTransition(async () => void toastResult(await assignMonitor(challengeId, team.id, value)));
                    }}
                  >
                    <option value="">Sem monitor</option>
                    {monitors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <span className="font-medium">{monitorName(team.assigned_monitor_id) ?? "—"}</span>
                )}
              </div>

              <ul className="flex-1 divide-y">
                {team.members.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sem integrantes.</li>}
                {team.members.map((m) => (
                  <li key={m.membershipId} className="flex items-center justify-between gap-2 px-4 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{m.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.registration ?? m.email ?? "Sem matrícula"}</p>
                    </div>
                    {canManage && team.active && (
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Ações para ${m.full_name}`} />}>
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => setTransfer({ studentId: m.id, studentName: m.full_name, fromTeamId: team.id, fromTeamName: team.name })}
                          >
                            <ArrowRightLeftIcon /> Transferir
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setRemove({ membershipId: m.membershipId, studentName: m.full_name, teamName: team.name })}
                          >
                            <UserMinusIcon /> Remover da equipe
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                ))}
              </ul>

              {canManage && team.active && (
                <footer className="border-t p-2">
                  <AddStudentDialog
                    defaultStartDate={challengeStartDate}
                    challengeId={challengeId}
                    teamId={team.id}
                    teamName={team.name}
                    trigger={
                      <Button variant="ghost" size="sm" className="w-full text-brand">
                        <UserPlusIcon /> Adicionar aluno
                      </Button>
                    }
                  />
                </footer>
              )}
            </article>
          ))}
        </div>
      )}

      <TransferDialog
        challengeId={challengeId}
        target={transfer}
        teams={activeTeams.map((t) => ({ id: t.id, name: t.name }))}
        onClose={() => setTransfer(null)}
      />
      <RemoveMemberDialog challengeId={challengeId} target={remove} onClose={() => setRemove(null)} />
      {editing && (
        <TeamDialog
          key={editing.id}
          challengeId={challengeId}
          team={editing}
          monitors={monitors}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Excluir ${deleting?.name ?? "equipe"}?`}
        description="Se a equipe já possuir avaliações, ela será apenas desativada para preservar o histórico."
        confirmLabel="Excluir"
        destructive
        onConfirm={async () => (deleting ? toastResult(await deleteTeam(challengeId, deleting.id)) : true)}
      />
    </div>
  );
}
