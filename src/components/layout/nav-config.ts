import {
  LayoutDashboardIcon,
  TrophyIcon,
  GraduationCapIcon,
  FileSpreadsheetIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon };

export function buildNav(opts: { isAdmin: boolean; isCoordinator: boolean }): NavItem[] {
  const items: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
    { label: "Desafios", href: "/desafios", icon: TrophyIcon },
  ];
  if (opts.isAdmin || opts.isCoordinator) {
    items.push({ label: "Alunos", href: "/alunos", icon: GraduationCapIcon });
  }
  items.push({ label: "Relatórios", href: "/relatorios", icon: FileSpreadsheetIcon });
  if (opts.isAdmin) items.push({ label: "Usuários", href: "/usuarios", icon: UsersIcon });
  return items;
}
