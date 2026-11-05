"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { buildNav } from "./nav-config";
import { UserCard, type SidebarUser } from "./user-card";
import { BottomNav } from "./bottom-nav";

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Nav({ items }: { items: ReturnType<typeof buildNav> }) {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-thin mt-8 min-h-0 flex-1 overflow-y-auto lg:mt-10">
      <ul className="flex flex-col gap-0.5 pb-4">
        {items.map(({ label, href, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-l-md border-r-4 px-3 text-[0.9375rem] transition-colors duration-200",
                  active
                    ? "border-brand bg-brand-soft font-medium text-foreground"
                    : "border-transparent hover:bg-surface",
                )}
              >
                <Icon className={cn("size-[1.15rem] shrink-0", active ? "text-brand" : "text-muted-foreground")} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar({ user, isAdmin, isCoordinator }: { user: SidebarUser; isAdmin: boolean; isCoordinator: boolean }) {
  const items = buildNav({ isAdmin, isCoordinator });
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <Logo />
      </header>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar py-8 pl-5 lg:flex">
        <div className="pr-4">
          <Logo />
        </div>
        <Nav items={items} />
        <UserCard user={user} />
      </aside>
      <BottomNav user={user} isAdmin={isAdmin} isCoordinator={isCoordinator} />
    </>
  );
}
