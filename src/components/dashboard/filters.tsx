"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronDownIcon, Loader2Icon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/shared/native-select";
import { FOLLOWUP_STATUS } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";

type Opt = { id: string; name: string };

export function DashboardFilters({
  challenges,
  teams,
  monitors,
  showSituation = true,
}: {
  challenges?: Opt[];
  teams?: Opt[];
  monitors?: Opt[];
  showSituation?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "desafio") {
      next.delete("equipe");
      next.delete("monitor");
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const activeCount = ["desafio", "equipe", "monitor", "de", "ate", "situacao"].filter((k) => params.get(k)).length;
  const hasAny = activeCount > 0;
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-4 sm:mb-6">
      {/* no celular os filtros ficam recolhidos até serem pedidos */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground sm:hidden"
      >
        <SlidersHorizontalIcon className="size-4" />
        Filtros{hasAny && <span className="text-brand"> ({activeCount})</span>}
        <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("flex-wrap items-end gap-2 rounded-2xl border bg-card p-3 sm:flex", open ? "flex animate-pop-in sm:animate-none" : "hidden")}>
      {challenges && (
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Desafio
          <NativeSelect value={params.get("desafio") ?? ""} onChange={(e) => set("desafio", e.target.value)}>
            <option value="">Todos os ativos</option>
            {challenges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      {teams && (
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Equipe
          <NativeSelect value={params.get("equipe") ?? ""} onChange={(e) => set("equipe", e.target.value)}>
            <option value="">Todas</option>
            {teams.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      {monitors && (
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Monitor
          <NativeSelect value={params.get("monitor") ?? ""} onChange={(e) => set("monitor", e.target.value)}>
            <option value="">Todos</option>
            {monitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      <label className="flex w-36 flex-col gap-1 text-xs text-muted-foreground">
        De
        <Input type="date" value={params.get("de") ?? ""} onChange={(e) => set("de", e.target.value)} />
      </label>
      <label className="flex w-36 flex-col gap-1 text-xs text-muted-foreground">
        Até
        <Input type="date" value={params.get("ate") ?? ""} onChange={(e) => set("ate", e.target.value)} />
      </label>
      {showSituation && (
        <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Situação
          <NativeSelect value={params.get("situacao") ?? ""} onChange={(e) => set("situacao", e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(FOLLOWUP_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </label>
      )}
      <div className="flex h-10 items-center">
        {pending ? (
          <Loader2Icon className="mx-2 size-4 animate-spin text-muted-foreground" />
        ) : (
          hasAny && (
            <Button variant="ghost" size="sm" onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}>
              <XIcon /> Limpar
            </Button>
          )
        )}
      </div>
      </div>
    </div>
  );
}
