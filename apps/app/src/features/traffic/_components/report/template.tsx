import { Skeleton } from "@/components/ui/skeleton";

export function TrafficReportTemplate() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-md" />
        ))}
      </div>
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <Skeleton className="min-h-[340px] rounded-md" />
        <Skeleton className="min-h-[340px] rounded-md" />
      </div>
    </div>
  );
}
