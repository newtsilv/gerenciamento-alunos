"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CircleUserIcon,
  FileSpreadsheetIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  SunIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { isEvaluationPath } from "./nav-config";
import type { SidebarUser } from "./user-card";

type Item = { key: string; label: string; icon: LucideIcon; href?: string; match: string[] };

const BAR_H = 64;
const RADIUS = 24;
const BUBBLE = 52;
const NOTCH_HALF = 44; // meia-largura do recorte
const NOTCH_DEPTH = 33; // profundidade do recorte

/** Contorno da barra com o recorte curvo centralizado em `cx`. */
function barPath(w: number, cx: number | null) {
  const r = RADIUS;
  const top =
    cx === null
      ? `H ${w - r}`
      : `H ${cx - NOTCH_HALF} C ${cx - NOTCH_HALF + 13} 0, ${cx - 30} ${NOTCH_DEPTH}, ${cx} ${NOTCH_DEPTH} C ${cx + 30} ${NOTCH_DEPTH}, ${cx + NOTCH_HALF - 13} 0, ${cx + NOTCH_HALF} 0 H ${w - r}`;
  return `M ${r} 0 ${top} A ${r} ${r} 0 0 1 ${w} ${r} V ${BAR_H - r} A ${r} ${r} 0 0 1 ${w - r} ${BAR_H} H ${r} A ${r} ${r} 0 0 1 0 ${BAR_H - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** Barra de navegação inferior para celular, com o item ativo em uma bolha flutuante. */
export function BottomNav({ user, isAdmin, isCoordinator }: { user: SidebarUser; isAdmin: boolean; isCoordinator: boolean }) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [cx, setCx] = useState<number | null>(null);
  const cxRef = useRef<number | null>(null);

  const items: Item[] = [
    { key: "inicio", label: "Início", icon: LayoutDashboardIcon, href: "/dashboard", match: ["/dashboard"] },
    { key: "desafios", label: "Desafios", icon: TrophyIcon, href: "/desafios", match: ["/desafios"] },
    ...(isAdmin || isCoordinator ? [{ key: "alunos", label: "Alunos", icon: GraduationCapIcon, href: "/alunos", match: ["/alunos"] }] : []),
    { key: "relatorios", label: "Relatórios", icon: FileSpreadsheetIcon, href: "/relatorios", match: ["/relatorios"] },
    { key: "conta", label: "Conta", icon: CircleUserIcon, match: ["/usuarios"] },
  ];
  const activeIndex = items.findIndex((it) => it.match.some((m) => pathname === m || pathname.startsWith(`${m}/`)));
  const ActiveIcon = activeIndex >= 0 ? items[activeIndex].icon : null;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // anima o recorte e a bolha juntos até o item ativo (sempre via requestAnimationFrame)
  useEffect(() => {
    const target = width && activeIndex >= 0 ? (width / items.length) * (activeIndex + 0.5) : null;
    const from = cxRef.current;
    const instant = target === null || from === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = instant ? 1 : Math.min(1, (now - start) / 420);
      const v = target === null ? null : instant ? target : from! + (target - from!) * easeOut(t);
      cxRef.current = v;
      setCx(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [activeIndex, width, items.length]);

  const itemInner = (it: Item, active: boolean) => (
    <>
      <it.icon className={cn("size-[22px] transition-all duration-300", active ? "translate-y-2 opacity-0" : "text-muted-foreground")} />
      <span className={cn("mt-1 text-[11px] leading-none transition-colors", active ? "font-semibold text-brand" : "text-muted-foreground")}>
        {it.label}
      </span>
    </>
  );
  const itemClass = "relative z-10 flex h-full flex-1 flex-col items-center justify-end pb-2.5 outline-none focus-visible:text-brand";

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("hide-on-keyboard fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 lg:hidden", isEvaluationPath(pathname) && "max-md:hidden")}
    >
      <div ref={ref} className="relative flex" style={{ height: BAR_H }}>
        {width > 0 && (
          <svg
            aria-hidden
            className="absolute inset-0 overflow-visible drop-shadow-[0_6px_18px_rgb(0_0_0/0.16)] dark:drop-shadow-[0_6px_18px_rgb(0_0_0/0.5)]"
            width={width}
            height={BAR_H}
            viewBox={`0 0 ${width} ${BAR_H}`}
          >
            <path d={barPath(width, cx)} fill="var(--nav-bar)" />
          </svg>
        )}
        {cx !== null && ActiveIcon && (
          <span
            aria-hidden
            className="absolute z-20 grid place-items-center rounded-full bg-[var(--nav-bubble)] text-[var(--nav-bubble-fg)] shadow-[0_6px_16px_-4px_rgb(7_71_222/0.55)] dark:shadow-[0_6px_16px_-4px_rgb(0_0_0/0.6)]"
            style={{ width: BUBBLE, height: BUBBLE, left: cx - BUBBLE / 2, top: -BUBBLE / 2 + 2 }}
          >
            <ActiveIcon key={activeIndex} className="size-[22px] animate-pop-in" />
          </span>
        )}

        {items.map((it, i) => {
          const active = i === activeIndex;
          if (it.href) {
            return (
              <Link key={it.key} href={it.href} aria-current={active ? "page" : undefined} className={itemClass}>
                {itemInner(it, active)}
              </Link>
            );
          }
          return (
            <DropdownMenu key={it.key}>
              <DropdownMenuTrigger className={itemClass} aria-label="Conta">
                {itemInner(it, active)}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" sideOffset={14} className="w-60">
                <div className="px-2 py-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.description}</p>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <DropdownMenuItem render={<Link href="/usuarios" />}>
                    <UsersIcon /> Usuários
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
                  {isDark ? <SunIcon /> : <MoonIcon />}
                  {isDark ? "Tema claro" : "Tema escuro"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
                  <LogOutIcon /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    </nav>
  );
}
