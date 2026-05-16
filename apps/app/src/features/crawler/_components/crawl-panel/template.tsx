import { Skeleton } from "@/components/ui/skeleton";

export function CrawlPanelTemplate() {
  return (
    <div className="grid min-h-[520px] grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Skeleton className="h-[520px] rounded-md" />
      <Skeleton className="h-[520px] rounded-md" />
    </div>
  );
}
