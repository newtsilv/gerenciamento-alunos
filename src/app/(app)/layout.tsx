import { NavigationHistory } from "@/components/layout/navigation-history";
import { Sidebar } from "@/components/layout/sidebar";
import { isCoordinatorAnywhere, requireViewer } from "@/lib/auth";
import { CHALLENGE_ROLE } from "@/lib/domain/constants";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireViewer();
  const roles = [...new Set(viewer.memberships.map((m) => CHALLENGE_ROLE[m.role]))];
  const description = viewer.isAdmin ? "Administrador" : roles.join(" · ") || "Sem vínculos";

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        user={{ name: viewer.fullName, description }}
        isAdmin={viewer.isAdmin}
        isCoordinator={isCoordinatorAnywhere(viewer)}
      />
      <NavigationHistory />
      <main className="flex min-w-0 flex-1 flex-col pb-28 lg:pb-0">{children}</main>
    </div>
  );
}
