import { Stagger, StaggerItem } from "@/components/shared/motion";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCapIcon } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchBox } from "@/components/shared/search-box";
import { requireViewer, isCoordinatorAnywhere } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Alunos" };

const PAGE = 50;

export default async function StudentsPage({ searchParams }: PageProps<"/alunos">) {
  const viewer = await requireViewer();
  if (!viewer.isAdmin && !isCoordinatorAnywhere(viewer)) notFound();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.p) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select("id, full_name, registration, email, team_memberships(end_date, team:teams(name, challenge:challenges(name)))", { count: "exact" })
    .order("full_name")
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`full_name.ilike.%${safe}%,registration.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data, count } = await query;
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));

  return (
    <PageContainer>
      <PageHeader title="Alunos" description={`${count ?? 0} aluno(s) visíveis para você.`} />
      <Stagger>
      <StaggerItem className="mb-4 sm:w-96">
        <SearchBox placeholder="Buscar por nome, matrícula ou e-mail…" />
      </StaggerItem>
      {!data?.length ? (
        <EmptyState icon={GraduationCapIcon} title="Nenhum aluno encontrado" description={q ? "Tente outro termo." : "Importe uma planilha em um desafio para cadastrar alunos."} />
      ) : (
        <StaggerItem className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-3 font-normal">Aluno</th>
                <th className="px-4 py-3 font-normal">Matrícula</th>
                <th className="px-4 py-3 font-normal">Equipe atual</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((s) => {
                const current = s.team_memberships.filter((m) => m.end_date === null && m.team);
                return (
                  <tr key={s.id} className="odd:bg-surface/50 hover:bg-brand-soft/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/alunos/${s.id}`} className="font-medium hover:text-brand">
                        {s.full_name}
                      </Link>
                      {s.email && <p className="text-xs text-muted-foreground">{s.email}</p>}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{s.registration ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {current.map((m, i) => (
                        <p key={i}>
                          {m.team!.name} <span className="text-xs text-muted-foreground">· {m.team!.challenge?.name}</span>
                        </p>
                      ))}
                      {!current.length && <span className="text-muted-foreground">Sem equipe ativa</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </StaggerItem>
      )}
      </Stagger>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link className="rounded-lg border px-3 py-1.5 hover:bg-surface" href={`/alunos?${new URLSearchParams({ ...(q && { q }), p: String(page - 1) })}`}>
              Anterior
            </Link>
          )}
          <span className="text-muted-foreground">
            Página {page} de {pages}
          </span>
          {page < pages && (
            <Link className="rounded-lg border px-3 py-1.5 hover:bg-surface" href={`/alunos?${new URLSearchParams({ ...(q && { q }), p: String(page + 1) })}`}>
              Próxima
            </Link>
          )}
        </nav>
      )}
    </PageContainer>
  );
}
