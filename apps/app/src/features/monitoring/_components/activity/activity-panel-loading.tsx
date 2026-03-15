import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ActivityPanelLoading() {
  return (
    <div className="h-auto lg:h-full lg:overflow-y-auto">
      <div className="flex flex-col gap-6 pb-4">
        <Card className="rounded-md">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>
              <Skeleton className="h-4 w-36" />
            </CardTitle>
            <Skeleton className="h-5 w-8 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-[72px] rounded-md" />
            <Skeleton className="h-[72px] rounded-md" />
            <Skeleton className="h-[72px] rounded-md" />
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>
              <Skeleton className="h-4 w-32" />
            </CardTitle>
            <Skeleton className="h-5 w-8 rounded-full" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-[108px] rounded-md" />
            <Skeleton className="h-[108px] rounded-md" />
            <Skeleton className="h-[108px] rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
