import { Skeleton } from "@/components/ui/skeleton";

export function ToolbarTemplate() {
  return (
    <div className="border-b px-4 py-4 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-5 w-32 rounded-md" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full max-w-96 rounded-md sm:w-80" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}

export function ProviderApiKeysPanelTemplate() {
  return (
    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`provider-keys-skeleton-${index}`}
          className="flex min-h-[200px] flex-col rounded-2xl border bg-card p-4"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <div className="mb-4 space-y-2">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
          <div className="mt-auto space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeveloperPlanHeroBannerTemplate() {
  return (
    <div className="rounded-md border bg-card p-4 md:p-5">
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-5/6 rounded-md" />
        <Skeleton className="h-10 w-44 rounded-md" />
      </div>
    </div>
  );
}

export function CatalogTemplate() {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-4">
      {Array.from({ length: 16 }).map((_, index) => (
        <div
          key={`models-panel-skeleton-${index}`}
          className="flex h-[172px] flex-col justify-between rounded-2xl border bg-card p-4"
        >
          <div className="space-y-3">
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-5 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-5/6 rounded-md" />
          </div>
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export { CatalogTemplate as Template };
