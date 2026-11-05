"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { buildNav } from "./nav-config";
import { UserCard, type SidebarUser } from "./user-card";

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
  const [open, setOpen] = useState(false);
  const items = buildNav({ isAdmin, isCoordinator });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function closeOnLink(e: MouseEvent) {
    if ((e.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/90 px-4 backdrop-blur-md sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="app-sidebar"
          className="-ml-2 rounded-lg p-2 transition-colors active:bg-surface"
        >
          <MenuIcon className="size-6" />
        </button>
        <Logo />
        <span className="w-8" />
      </header>

      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-navy/40 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        id="app-sidebar"
        onClick={closeOnLink}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,85vw)] flex-col border-r bg-sidebar py-6 pl-5 transition-[translate,visibility] duration-300 ease-out-expo",
          "lg:visible lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:translate-x-0 lg:pt-8",
          open ? "visible translate-x-0 shadow-2xl" : "invisible -translate-x-full",
        )}
      >
        <div className="flex items-center justify-between pr-4">
          <Logo />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-2 text-muted-foreground transition-colors active:bg-surface lg:hidden"
          >
            <XIcon className="size-6" />
          </button>
        </div>
        <Nav items={items} />
        <UserCard user={user} />
      </aside>
    </>
  );
}
