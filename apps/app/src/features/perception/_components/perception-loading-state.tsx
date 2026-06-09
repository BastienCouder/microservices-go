import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PerceptionThreeColumnLayout } from "./perception-three-column-layout";

export function PerceptionLoadingState() {
  return (
    <PerceptionThreeColumnLayout
      left={
        <div className="space-y-4 p-2">
          <Card className="border-border/60">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-3 rounded-xl bg-primary/8 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
              </div>

              <div className="space-y-3">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-10 w-full rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-[92px] w-full rounded-md" />
                  <Skeleton className="h-[92px] w-full rounded-md" />
                  <Skeleton className="h-[92px] w-full rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Card className="border-border/60 overflow-hidden py-4">
            <CardContent className="space-y-4 px-5 py-0">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <Skeleton className="h-14 w-20 rounded-md" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-[84px] w-full rounded-xl" />
                <Skeleton className="h-[84px] w-full rounded-xl" />
                <Skeleton className="h-[84px] w-full rounded-xl" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-border/60">
            <CardHeader className="pb-2">
              <CardTitle><Skeleton className="h-4 w-44" /></CardTitle>
              <CardDescription><Skeleton className="h-3 w-72 max-w-full" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle><Skeleton className="h-4 w-40" /></CardTitle>
              <CardDescription><Skeleton className="h-3 w-80 max-w-full" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[230px] w-full rounded-md" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Skeleton className="h-[74px] w-full rounded-md" />
                <Skeleton className="h-[74px] w-full rounded-md" />
                <Skeleton className="h-[74px] w-full rounded-md" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
      right={
        <div className="px-1 pb-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle><Skeleton className="h-4 w-36" /></CardTitle>
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[116px] w-full rounded-md" />
              <Skeleton className="h-[116px] w-full rounded-md" />
              <Skeleton className="h-[116px] w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}

export function BrandCanonLoadingState() {
  return (
    <div className="mx-0 my-0 grid grid-cols-12 gap-0 md:m-4 xl:h-full xl:min-h-0">
      <div className="col-span-12 xl:col-span-8 xl:col-start-3">
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-28 w-full rounded-xl" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>
            <Skeleton className="h-44 w-full rounded-xl" />
            <div className="grid gap-4 xl:grid-cols-2">
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
