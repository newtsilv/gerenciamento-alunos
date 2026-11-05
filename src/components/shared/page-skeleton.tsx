import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto exibido enquanto a próxima tela carrega (a navegação muda na hora). */
export function PageSkeleton({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
      {withHeader && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
