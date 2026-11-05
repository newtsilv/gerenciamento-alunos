import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChallengeForm } from "@/components/challenges/challenge-form";
import { MembersManager } from "@/components/challenges/members-manager";
import { DeleteChallengeButton } from "@/components/challenges/delete-challenge-button";
import { requireChallengeAccess } from "@/lib/auth";
import { getChallenge } from "@/lib/data/challenges";
import { createClient } from "@/lib/supabase/server";

export default async function ChallengeSettingsPage({ params }: PageProps<"/desafios/[id]/configuracoes">) {
  const { id } = await params;
  const access = await requireChallengeAccess(id);
  if (!access.canManage) notFound();
  const challenge = await getChallenge(id);
  if (!challenge) notFound();

  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("id, full_name, email, login").eq("active", true).order("full_name");

  const members = challenge.challenge_members
    .filter((m) => m.profiles)
    .map((m) => ({
      memberId: m.id,
      id: m.user_id,
      name: m.profiles!.full_name || m.profiles!.email,
      email: m.profiles!.login ? `RA ${m.profiles!.login}` : m.profiles!.email,
      role: m.role,
    }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Dados do desafio</CardTitle>
          <CardDescription>Alterar os dias de acompanhamento atualiza as sessões futuras sem avaliações.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChallengeForm
            challengeId={id}
            defaultValues={{
              name: challenge.name,
              company: challenge.company,
              description: challenge.description,
              start_date: challenge.start_date,
              end_date: challenge.end_date,
              status: challenge.status,
              monitoring_weekdays: challenge.monitoring_weekdays,
            }}
          />
        </CardContent>
      </Card>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Equipe de acompanhamento</CardTitle>
            <CardDescription>Coordenadores, professores e monitores vinculados. As quantidades são livres.</CardDescription>
          </CardHeader>
          <CardContent>
            <MembersManager
              challengeId={id}
              members={members}
              people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email, email: p.login ? `RA ${p.login}` : p.email }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Critérios de avaliação</CardTitle>
            <CardDescription>Notas de 1 a 5 usadas na avaliação das equipes e dos alunos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href={`/desafios/${id}/criterios`} />}>
              Editar critérios
            </Button>
          </CardContent>
        </Card>
        {access.viewer.isAdmin && (
          <Card className="border-danger/30">
            <CardHeader>
              <CardTitle>Zona de perigo</CardTitle>
              <CardDescription>A exclusão remove todos os dados do desafio.</CardDescription>
            </CardHeader>
            <CardContent>
              <DeleteChallengeButton challengeId={id} name={challenge.name} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
