import { Skeleton } from "@/components/ui/skeleton";

export function ModelsPanelLoading() {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-4">
      {Array.from({ length: 8 }).map((_, index) => (
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
