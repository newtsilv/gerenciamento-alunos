"use client";

import { usePathname } from "next/navigation";
import { isEvaluationPath } from "@/components/layout/nav-config";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Esqueletos com a mesma estrutura de cada tela: repetem margens, alturas de linha e cartões
 * para o conteúdo real entrar no lugar sem a página pular.
 */
const lineHeight = { xs: "h-4", sm: "h-5", base: "h-6", lg: "h-7" };

/** Linha de texto: ocupa a altura da linha real, com a barra um pouco mais fina. */
function Line({ size = "sm", className, wrap }: { size?: keyof typeof lineHeight; className?: string; wrap?: string }) {
  return (
    <div className={cn("flex items-center", lineHeight[size], wrap)}>
      <Skeleton className={cn("h-[70%]", className)} />
    </div>
  );
}

const many = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Texto que quebra em mais linhas no celular do que no desktop. */
function MobileExtraLines({ count, size }: { count: number; size?: keyof typeof lineHeight }) {
  return many(count).map((i) => <Line key={i} size={size} className="w-3/5" wrap="sm:hidden" />);
}
const card = "rounded-2xl border bg-card";

function HeaderSkeleton({
  titleWidth = "w-44",
  descriptionWidth = "w-72",
  back,
  action,
  extraLines = 0,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  back?: boolean;
  action?: string;
  extraLines?: number;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <Line className="w-16" wrap="mb-2" />}
        <div className="flex h-[30px] items-center sm:h-[35px]">
          <Skeleton className={cn("h-[75%]", titleWidth)} />
        </div>
        <Line size="base" className={cn("max-w-full", descriptionWidth)} wrap="mt-1" />
        <MobileExtraLines count={extraLines} size="base" />
      </div>
      {action && <Skeleton className={cn("h-10 shrink-0 rounded-lg max-sm:w-full", action)} />}
    </div>
  );
}

function ChallengeHeaderSkeleton() {
  return (
    <>
      <div className="mb-2 sm:mb-4">
        <Line size="base" className="w-16" />
        <div className="mt-1 flex h-7 items-center sm:h-[43.5px]">
          <Skeleton className="h-[75%] w-4/5 sm:w-96" />
        </div>
        <Line className="w-64" wrap="mt-0.5 max-sm:hidden" />
      </div>
      <div className="-mx-4 mb-4 flex h-11 items-center justify-between gap-4 border-b px-2 sm:mx-0 sm:mb-6 sm:justify-start sm:px-3">
        {["w-20", "w-16", "w-16", "w-20"].map((w, i) => (
          <Skeleton key={i} className={cn("h-4", w)} />
        ))}
        <Skeleton className="ml-auto size-4" />
      </div>
    </>
  );
}

function FiltersSkeleton({ fields = 4 }: { fields?: number }) {
  const field = (className: string, key: number) => (
    <div key={key} className={cn("flex flex-col gap-1", className)}>
      <Line size="xs" className="w-14" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
  return (
    <div className="mb-4 sm:mb-6">
      <Line className="w-24" wrap="h-10 sm:hidden" />
      <div className={cn("hidden flex-wrap items-end gap-2 p-3 sm:flex", card)}>
        {field("min-w-48 flex-1", 0)}
        {field("w-36", 1)}
        {field("w-36", 2)}
        {fields > 3 && field("min-w-44 flex-1", 3)}
      </div>
    </div>
  );
}

function StatSkeleton({ hint, extraHintLines = 0, className }: { hint?: boolean; extraHintLines?: number; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-4 sm:p-5", card, className)}>
      <div className="min-w-0 flex-1">
        <Line className="w-20 max-w-full" />
        <Skeleton className="mt-1 h-[35px] w-14" />
        {hint && <Line size="xs" className="w-full max-w-28" wrap="mt-1" />}
        <MobileExtraLines count={extraHintLines} size="xs" />
      </div>
      <Skeleton className="size-10 shrink-0 rounded-xl max-sm:hidden" />
    </div>
  );
}

function Panel({
  titleWidth = "w-48",
  description,
  extraLines = 0,
  children,
  className,
}: {
  titleWidth?: string;
  description?: string;
  extraLines?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 p-4 sm:p-5", card, className)}>
      <div className="mb-4">
        <Line size="base" className={titleWidth} />
        {description && <Line className={cn("max-w-full", description)} />}
        <MobileExtraLines count={extraLines} />
      </div>
      {children}
    </div>
  );
}

function ChartBody() {
  return (
    <>
      <Skeleton className="h-64 rounded-xl" />
      <Line size="xs" className="w-16" wrap="mt-2" />
    </>
  );
}

function SituationBody() {
  return (
    <div>
      <Skeleton className="h-3 rounded-full" />
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {many(5).map((i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <Line className="w-36" />
            <Line className="w-10" />
          </div>
        ))}
      </div>
      <Line size="xs" className="w-4/5" wrap="mt-3" />
    </div>
  );
}

function RowsBody({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y">
      {many(rows).map((i) => (
        <div key={i} className="flex flex-col gap-1.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <Line size="base" className="w-32" />
            <Line size="xs" className="w-24" />
          </div>
          <Line className="w-3/4" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ columns, rows = 8, twoLines = true, rowClassName }: { columns: string[]; rows?: number; twoLines?: boolean; rowClassName?: string }) {
  return (
    <div className={cn("overflow-x-auto", card)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {columns.map((w, i) => (
              <th key={i} className="px-4 py-3">
                <Line className={w} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {many(rows).map((r) => (
            <tr key={r} className={rowClassName}>
              {columns.map((w, i) => (
                <td key={i} className="px-4 py-2.5">
                  <Line className={i === 0 ? "w-24 sm:w-48" : w} />
                  {twoLines && i === 0 && <Line size="xs" className="w-16 sm:w-32" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreRow({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Line className="w-40" wrap="mb-2" />
      <div className="grid grid-cols-6 gap-1.5">
        {many(6).map((i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- telas ---------------------------- */

function DashboardSkeleton() {
  return (
    <>
      <HeaderSkeleton titleWidth="w-52" descriptionWidth="w-64" />
      <FiltersSkeleton />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {many(4).map((i) => (
          <StatSkeleton key={i} hint={i === 3} className="max-sm:hidden" />
        ))}
        <StatSkeleton hint extraHintLines={2} />
        <StatSkeleton hint />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel description="w-96" extraLines={1}>
          <ChartBody />
        </Panel>
        <Panel description="w-64">
          <SituationBody />
        </Panel>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel description="w-80" extraLines={1}>
          <RowsBody rows={3} />
        </Panel>
        <Panel description="w-56">
          <Skeleton className="h-[220px] rounded-xl" />
        </Panel>
      </div>
    </>
  );
}

function ChallengesSkeleton() {
  return (
    <>
      <HeaderSkeleton titleWidth="w-36" descriptionWidth="w-96" extraLines={1} action="w-36" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {many(4).map((i) => (
          <div key={i} className={cn("flex items-center gap-3 p-4 sm:gap-4 sm:p-5", card)}>
            <Skeleton className="size-10 shrink-0 rounded-xl sm:size-12 sm:rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Line size="base" className="w-3/5" />
              <Line className="w-4/5" wrap="mt-0.5" />
            </div>
            <Skeleton className="size-5 shrink-0" />
          </div>
        ))}
      </div>
    </>
  );
}

function StudentsSkeleton() {
  return (
    <>
      <HeaderSkeleton titleWidth="w-28" descriptionWidth="w-56" />
      <Skeleton className="mb-4 h-10 rounded-lg sm:w-96" />
      <TableSkeleton columns={["w-16", "w-14", "w-20"]} rows={10} rowClassName="max-sm:h-[101px]" />
    </>
  );
}

function StudentDetailSkeleton() {
  return (
    <>
      <HeaderSkeleton back titleWidth="w-72" descriptionWidth="w-56" action="w-24" />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.5fr]">
        <Panel>
          <RowsBody rows={2} />
        </Panel>
        <Panel>
          <RowsBody rows={4} />
        </Panel>
      </div>
    </>
  );
}

function ReportsSkeleton() {
  return (
    <>
      <HeaderSkeleton titleWidth="w-36" descriptionWidth="w-[28rem]" extraLines={1} />
      <div className="flex flex-col gap-6">
        <div className="flex max-w-md flex-col gap-1.5">
          <Line className="w-16" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {many(3).map((i) => (
            <div key={i} className={cn("flex flex-col gap-4 p-5", card)}>
              <div className="flex gap-3">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Line size="base" className="w-3/5" />
                  <Line className="w-full" />
                  <Line className="w-4/5" />
                </div>
              </div>
              {i < 2 && (
                <div className="flex flex-col gap-1.5">
                  <Line className="w-40" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
              )}
              {i === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {many(5).map((c) => (
                    <Skeleton key={c} className="h-8 w-[88px] rounded-lg" />
                  ))}
                </div>
              )}
              <Skeleton className="mt-auto h-10 w-44 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function UsersSkeleton() {
  return (
    <>
      <HeaderSkeleton titleWidth="w-32" descriptionWidth="w-[32rem]" extraLines={2} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Skeleton className="h-10 rounded-lg sm:w-80" />
          <Skeleton className="h-10 rounded-lg sm:w-36" />
        </div>
        <TableSkeleton columns={["w-16", "w-14", "w-32", "w-14", "w-6"]} rows={6} twoLines={false} rowClassName="max-sm:h-[65px]" />
      </div>
    </>
  );
}

function DayPickerSkeleton() {
  return (
    <div className={cn("p-4 sm:p-6", card)}>
      <div className="mb-3 flex items-start gap-3 sm:mb-4">
        <Skeleton className="size-10 shrink-0 rounded-xl max-sm:hidden" />
        <div className="min-w-0 flex-1">
          <div className="flex h-6 items-center sm:h-7">
            <Skeleton className="h-[70%] w-56" />
          </div>
          <Line className="w-96 max-w-full" wrap="max-sm:hidden" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {many(5).map((i) => (
          <Skeleton key={i} className={cn("h-14 rounded-xl sm:w-28", i === 0 && "max-sm:col-span-3", i === 4 && "max-sm:hidden")} />
        ))}
      </div>
      <Line className="w-36" wrap="mt-2 h-9 sm:hidden" />
      <div className="mt-4 hidden items-center gap-2 border-t pt-4 sm:flex">
        <Line className="w-16" wrap="sm:w-24" />
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

function FollowUpHomeSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <DayPickerSkeleton />
      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <Line size="base" className="w-52" />
          <Line className="w-52" />
        </div>
        <div className={cn("divide-y overflow-hidden", card)}>
          {many(6).map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="w-28 shrink-0">
                <Line size="base" className="w-24" />
                <Line size="xs" className="w-16" />
              </div>
              <div className="min-w-0 flex-1">
                <Skeleton className="h-2 rounded-full" />
                <Line size="xs" className="w-40 max-w-full" wrap="mt-1" />
              </div>
              <Skeleton className="h-8 w-32 shrink-0 rounded-lg max-sm:hidden" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SessionDaySkeleton() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
        <div className="flex h-6 items-center sm:h-7">
          <Skeleton className="h-[70%] w-60" />
        </div>
        <Skeleton className="h-10 w-48 rounded-lg max-sm:hidden" />
      </div>
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {many(3).map((i) => (
            <Skeleton key={i} className="h-10 rounded-xl sm:h-[70px]" />
          ))}
        </div>
        <div className="hidden gap-2 sm:grid sm:grid-cols-[1fr_200px]">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
          {many(9).map((i) => (
            <div key={i} className={cn("flex items-center gap-3 px-4 py-3 sm:flex-col sm:items-stretch sm:p-4", card)}>
              <div className="flex min-w-0 flex-1 items-start justify-between gap-2 sm:flex-none">
                <div className="min-w-0">
                  <Line size="base" className="w-14" />
                  <Line size="xs" className="w-24" wrap="sm:h-5" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Line className="w-28" wrap="hidden sm:flex" />
              <Skeleton className="size-5 shrink-0 sm:hidden" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EvaluationSkeleton() {
  return (
    <>
      {/* celular: mesmos passos do registro */}
      <div className="flex flex-col gap-4 pb-6 md:hidden">
        <div className="-mx-4 -mt-6 border-b">
          <div className="flex h-14 items-center gap-1 pr-4 pl-1">
            <div className="grid size-10 place-items-center">
              <Skeleton className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Line size="base" className="w-16" wrap="h-5" />
              <Line size="xs" className="w-32" />
            </div>
          </div>
          <div className="grid h-11 grid-cols-3 place-items-center">
            {many(3).map((i) => (
              <Skeleton key={i} className="h-3.5 w-16" />
            ))}
          </div>
        </div>
        <Skeleton className="h-[52px] rounded-2xl" />
        <div className="flex flex-col gap-5">
          {many(6).map((i) => (
            <ScoreRow key={i} />
          ))}
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Skeleton className="h-11 rounded-lg" />
        </div>
      </div>

      {/* desktop */}
      <div className="hidden flex-col gap-5 pb-24 md:flex">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Line size="lg" className="w-20" />
            <Line className="w-72" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className={card}>
          <div className="flex h-14 items-center justify-between px-4">
            <Line className="w-72" />
            <Line className="w-16" />
          </div>
          <div className="grid gap-4 border-t p-4 md:grid-cols-2">
            <div>
              <Line size="xs" className="w-40" wrap="mb-1" />
              <Line className="w-48" />
            </div>
            <div>
              <Line size="xs" className="w-52" wrap="mb-1" />
              <Line className="w-48" />
            </div>
            <div className="md:col-span-2">
              <Line className="w-72" wrap="mb-2" />
              <div className="flex flex-wrap gap-1.5">
                {["w-24", "w-44", "w-28", "w-40"].map((w, i) => (
                  <Skeleton key={i} className={cn("h-9 rounded-lg", w)} />
                ))}
              </div>
              <Skeleton className="mt-2 h-16 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className={cn("p-4 sm:p-5", card)}>
            <Line size="base" className="w-40" wrap="mb-4" />
            <div className="divide-y">
              {many(6).map((i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-3">
                  <Line className="w-48" />
                  <Skeleton className="h-9 w-[248px] rounded-lg" />
                </div>
              ))}
            </div>
          </div>
          <div className={cn("h-fit p-4", card)}>
            <Line size="base" className="w-40" wrap="mb-3" />
            <Line className="w-full" />
          </div>
        </div>
      </div>
    </>
  );
}

function TeamsBoardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_200px] lg:max-w-2xl">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
        <div className="flex flex-wrap gap-2 lg:shrink-0">
          {["w-28", "w-28", "w-36", "w-28"].map((w, i) => (
            <Skeleton key={i} className={cn("h-10 rounded-lg", w)} />
          ))}
        </div>
      </div>
      <Line className="w-48" />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {many(6).map((i) => (
          <div key={i} className={cn("flex flex-col", card)}>
            <div className="border-b p-4">
              <Line size="base" className="w-16" />
            </div>
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <Line className="w-14" />
              <Skeleton className="h-8 flex-1 rounded-lg" />
            </div>
            <div className="flex-1 divide-y">
              {many(4).map((r) => (
                <div key={r} className="px-4 py-2">
                  <Line className="w-3/5" />
                  <Line size="xs" className="w-16" />
                </div>
              ))}
            </div>
            <div className="border-t p-2">
              <Skeleton className="mx-auto h-8 w-36 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Line size="lg" className="w-24" />
        <Line className="w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-6">
          <Panel titleWidth="w-36">
            <div className="divide-y">
              {many(4).map((i) => (
                <div key={i} className="flex justify-between gap-2 py-2">
                  <Line className="w-2/5" />
                  <Line size="xs" className="w-32" wrap="h-5" />
                </div>
              ))}
            </div>
          </Panel>
          <Panel titleWidth="w-24">
            <Skeleton className="h-16 rounded-xl" />
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <Panel titleWidth="w-56">
            <RowsBody rows={2} />
          </Panel>
          <Panel titleWidth="w-52">
            <Skeleton className="h-24 rounded-xl" />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function DeliverablesSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Panel titleWidth="w-40" description="w-44">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-52 rounded-lg" />
          </div>
          <div className="divide-y rounded-xl border">
            {many(4).map((i) => (
              <div key={i} className="px-3 py-2">
                <Line className="w-3/5" />
                <Line size="xs" className="w-28" />
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <Panel titleWidth="w-44" description="w-72">
        <div className="flex flex-col gap-1">
          {many(8).map((i) => (
            <Skeleton key={i} className="h-8 rounded-md" />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <FiltersSkeleton />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {many(4).map((i) => (
          <StatSkeleton key={i} hint={i < 3} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel titleWidth="w-56">
          <ChartBody />
        </Panel>
        <Panel>
          <SituationBody />
        </Panel>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel titleWidth="w-52">
          <RowsBody rows={3} />
        </Panel>
        <Panel titleWidth="w-52">
          <Skeleton className="h-[220px] rounded-xl" />
        </Panel>
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div>
      <FiltersSkeleton />
      <TableSkeleton columns={["w-20", "w-16", "w-20", "w-10", "w-52", "w-32", "w-16"]} rows={8} twoLines={false} />
    </div>
  );
}

function SettingsCard({ titleWidth, children }: { titleWidth: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-5 py-5", card)}>
      <div className="flex flex-col gap-1 px-5">
        <Line size="base" className={titleWidth} />
        <Line className="w-4/5" />
        <MobileExtraLines count={1} />
      </div>
      <div className="px-5">{children}</div>
    </div>
  );
}

function SettingsSkeleton() {
  const field = (span?: boolean, key?: number) => (
    <div key={key} className={cn("flex flex-col gap-1.5", span && "sm:col-span-2")}>
      <Line className="w-32" />
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <SettingsCard titleWidth="w-40">
        <div className="grid gap-4 sm:grid-cols-2">
          {field(true, 0)}
          {many(5).map((i) => field(false, i + 1))}
        </div>
      </SettingsCard>
      <div className="flex flex-col gap-6">
        <SettingsCard titleWidth="w-56">
          <Skeleton className="h-40 rounded-xl" />
        </SettingsCard>
        <SettingsCard titleWidth="w-48">
          <Skeleton className="h-10 w-36 rounded-lg" />
        </SettingsCard>
      </div>
    </div>
  );
}

function CriteriaSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Line className="w-[36rem] max-w-full" />
        <MobileExtraLines count={2} />
      </div>
      {many(2).map((s) => (
        <div key={s} className={cn("p-5", card)}>
          <div className="mb-4 flex items-center justify-between">
            <Line size="base" className="w-40" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          <div className="divide-y rounded-xl border">
            {many(6).map((i) => (
              <div key={i} className="flex h-[49px] items-center justify-between gap-2 px-3">
                <Line className="w-48" />
                <Skeleton className="h-8 w-32 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImportSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function challengeBody(rest: string[]) {
  const [section, a, b] = rest;
  if (!section) return <FollowUpHomeSkeleton />;
  if (section === "acompanhamentos") return b ? <EvaluationSkeleton /> : a ? <SessionDaySkeleton /> : <FollowUpHomeSkeleton />;
  if (section === "equipes") return !a ? <TeamsBoardSkeleton /> : a === "importar" ? <ImportSkeleton /> : <TeamDetailSkeleton />;
  if (section === "entregas") return <DeliverablesSkeleton />;
  if (section === "resultados") return <ResultsSkeleton />;
  if (section === "historico") return <HistorySkeleton />;
  if (section === "configuracoes") return <SettingsSkeleton />;
  if (section === "criterios") return <CriteriaSkeleton />;
  return <FollowUpHomeSkeleton />;
}

function topLevelBody(parts: string[]) {
  const [section, id] = parts;
  if (section === "desafios") return <ChallengesSkeleton />;
  if (section === "alunos") return id ? <StudentDetailSkeleton /> : <StudentsSkeleton />;
  if (section === "relatorios") return <ReportsSkeleton />;
  if (section === "usuarios") return <UsersSkeleton />;
  return <DashboardSkeleton />;
}

/**
 * Escolhe o esqueleto da tela de destino pela URL.
 * `insideChallenge`: o cabeçalho e as abas do desafio já estão na tela, falta só o conteúdo da aba.
 */
export function RouteSkeleton({ insideChallenge }: { insideChallenge?: boolean }) {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const isChallenge = parts[0] === "desafios" && !!parts[1];
  const a11y = { "aria-busy": true, "aria-label": "Carregando", role: "status" } as const;

  if (insideChallenge) return <div {...a11y}>{challengeBody(parts.slice(2))}</div>;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8" {...a11y}>
      {isChallenge ? (
        <>
          <div className={isEvaluationPath(pathname) ? "max-md:hidden" : undefined}>
            <ChallengeHeaderSkeleton />
          </div>
          {challengeBody(parts.slice(2))}
        </>
      ) : (
        topLevelBody(parts)
      )}
    </div>
  );
}
