import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { UsersTable } from "@/components/users/users-table";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TECHNICAL_EMAIL_DOMAIN } from "@/lib/auth-provider";

export const metadata: Metadata = { title: "Usuários" };

export default async function UsersPage() {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, login, email, is_admin, active, challenge_members(role, challenge:challenges(name))")
    .order("full_name");

  return (
    <PageContainer>
      <PageHeader title="Usuários" description="Contas de acesso. Vincule as pessoas aos desafios em Desafios › Configurações." />
      <UsersTable
        viewerId={viewer.id}
        users={(data ?? []).map((u) => ({
          id: u.id,
          full_name: u.full_name || u.email,
          login: u.login,
          email: u.email,
          technicalEmail: u.email.endsWith(`@${TECHNICAL_EMAIL_DOMAIN}`),
          is_admin: u.is_admin,
          active: u.active,
          roles: u.challenge_members.map((m) => ({ role: m.role, challenge: m.challenge?.name ?? "" })),
        }))}
      />
    </PageContainer>
  );
}
