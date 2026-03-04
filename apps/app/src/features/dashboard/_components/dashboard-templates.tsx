"use client";

import { Skeleton } from "@/components/ui/skeleton";

function SectionCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-3 h-28 w-full rounded-xl" />
    </div>
  );
}

export function FiltersPanelSkeleton() {
  return (
    <div className="h-full w-full rounded-md bg-background p-2">
      <div className="space-y-4 rounded-xl bg-card p-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-px w-full rounded-none" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-px w-full rounded-none" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
         <Skeleton className="h-px w-full rounded-none" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function AnalyticsPanelSkeleton() {
  return (
    <div className="h-full w-full px-1">
      <div className="flex flex-col gap-4 pb-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>

        <SectionCardSkeleton />
        <SectionCardSkeleton />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SectionCardSkeleton />
          <SectionCardSkeleton />
        </div>

        <SectionCardSkeleton className="pb-2" />
      </div>
    </div>
  );
}

export function ActivityPanelSkeleton() {
  return (
    <div className="h-full w-full">
      <div className="flex flex-col gap-6 px-1 pb-4">
        <div className="space-y-3 rounded-xl p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>

        <div className="space-y-3 rounded-xl p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
