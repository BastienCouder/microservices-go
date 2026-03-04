import { Skeleton } from "@/components/ui/skeleton";

export function PageTemplateLoading() {
  return (
    <section className="card space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </section>
  );
}
