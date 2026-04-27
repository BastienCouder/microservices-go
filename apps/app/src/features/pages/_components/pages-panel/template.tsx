import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function Template() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="space-y-3 px-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-[40rem] max-w-full" />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,2.05fr)]">
        <Card className="min-h-[420px] rounded-md">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-4 w-32" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
            <Skeleton className="h-24 rounded-md" />
          </CardContent>
        </Card>

        <div className="grid min-h-0 gap-4 overflow-y-auto pr-1">
          <Skeleton className="h-[260px] rounded-md" />
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            <Skeleton className="h-[220px] rounded-md" />
            <Skeleton className="h-[220px] rounded-md" />
            <Skeleton className="h-[220px] rounded-md" />
            <Skeleton className="h-[220px] rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
