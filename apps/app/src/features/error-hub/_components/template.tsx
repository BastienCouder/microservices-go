import { Skeleton } from "@/components/ui/skeleton";

export function ErrorHubColumnLoading() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <ErrorHubCardSkeleton key={index} />
      ))}
    </>
  );
}

function ErrorHubCardSkeleton() {
  return (
    <div className="w-full rounded-md bg-background p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-6 w-6 shrink-0 rounded-md" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="mb-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Skeleton className="h-6 w-20 rounded-sm" />
          <Skeleton className="h-6 w-24 rounded-sm" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-sm" />
          <Skeleton className="h-7 w-20 rounded-sm" />
        </div>
      </div>
    </div>
  );
}