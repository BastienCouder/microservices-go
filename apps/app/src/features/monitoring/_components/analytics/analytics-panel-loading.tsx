import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsPanelLoading() {
  return (
    <div className="h-auto px-0 md:px-1 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-col gap-4 pb-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-24" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-28" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-24" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-4 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[220px] w-full rounded-md" />
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-4 w-44" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[260px] w-full rounded-md" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-32" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[220px] w-full rounded-md" />
            </CardContent>
          </Card>
          <Card className="rounded-md">
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-36" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[220px] w-full rounded-md" />
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-4 w-36" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
