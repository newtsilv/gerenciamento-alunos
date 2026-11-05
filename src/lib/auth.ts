import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ChallengeRole } from "@/lib/domain/constants";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  memberships: { challengeId: string; role: ChallengeRole }[];
};

/** Usuário atual (deduplicado por requisição). Retorna null se não autenticado/inativo. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, is_admin, active").eq("id", userId).maybeSingle(),
    supabase.from("challenge_members").select("challenge_id, role").eq("user_id", userId),
  ]);

  if (!profile || !profile.active) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name || profile.email,
    isAdmin: profile.is_admin,
    memberships: (memberships ?? []).map((m) => ({ challengeId: m.challenge_id, role: m.role })),
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) notFound();
  return viewer;
}

export function rolesIn(viewer: Viewer, challengeId: string): ChallengeRole[] {
  return viewer.memberships.filter((m) => m.challengeId === challengeId).map((m) => m.role);
}

export function canViewChallenge(viewer: Viewer, challengeId: string) {
  return viewer.isAdmin || rolesIn(viewer, challengeId).length > 0;
}

export function canManageChallenge(viewer: Viewer, challengeId: string) {
  return viewer.isAdmin || rolesIn(viewer, challengeId).includes("coordenador");
}

export function canEvaluateChallenge(viewer: Viewer, challengeId: string) {
  return viewer.isAdmin || rolesIn(viewer, challengeId).includes("monitor");
}

export function isCoordinatorAnywhere(viewer: Viewer) {
  return viewer.memberships.some((m) => m.role === "coordenador");
}

export type ChallengeAccess = {
  viewer: Viewer;
  roles: ChallengeRole[];
  canManage: boolean;
  canEvaluate: boolean;
};

/** Garante acesso ao desafio (404 quando o usuário não participa). */
export async function requireChallengeAccess(challengeId: string): Promise<ChallengeAccess> {
  const viewer = await requireViewer();
  if (!canViewChallenge(viewer, challengeId)) notFound();
  return {
    viewer,
    roles: rolesIn(viewer, challengeId),
    canManage: canManageChallenge(viewer, challengeId),
    canEvaluate: canEvaluateChallenge(viewer, challengeId),
  };
}
