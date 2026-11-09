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
  const [{ data }, { data: challenges }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, login, email, is_admin, active, challenge_members(id, role, challenge_id, challenge:challenges(name))")
      .order("full_name"),
    supabase.from("challenges").select("id, name").order("start_date", { ascending: false }),
  ]);

  return (
    <PageContainer>
      <PageHeader title="Usuários" description="" />
      <UsersTable
        viewerId={viewer.id}
        challenges={challenges ?? []}
        users={(data ?? []).map((u) => ({
          id: u.id,
          full_name: u.full_name || u.email,
          login: u.login,
          email: u.email,
          technicalEmail: u.email.endsWith(`@${TECHNICAL_EMAIL_DOMAIN}`),
          is_admin: u.is_admin,
          active: u.active,
          roles: u.challenge_members.map((m) => ({ memberId: m.id, challengeId: m.challenge_id, role: m.role, challenge: m.challenge?.name ?? "" })),
        }))}
      />
    </PageContainer>
  );
}
