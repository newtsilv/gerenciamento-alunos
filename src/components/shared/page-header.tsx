import { Reveal } from "@/components/shared/motion";
import type { ReactNode } from "react";
import { BackLink } from "./back-link";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <Reveal as="header" className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <BackLink fallback={back.href} className="mb-2" />
        )}
        <h1 className="text-2xl leading-tight font-semibold text-foreground sm:text-[1.75rem]">{title}</h1>
        {description && <div className="mt-1 text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 max-sm:*:flex-1">{actions}</div>}
    </Reveal>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>;
}
