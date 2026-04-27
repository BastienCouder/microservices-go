import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18nScope } from "@/shared/hooks/use-i18n";

import { SectionTitle } from "@/components/shared/section-title";

export function Template() {
  const content = useI18nScope("monitoring-filters-panel");

  return (
    <div className="flex h-auto flex-col lg:h-full">
      <div className="min-h-0 flex-1 overflow-y-auto p-2 no-scrollbar lg:min-h-0 lg:p-2">
        <div className="flex flex-col gap-5 pb-4">
          <Skeleton className="h-[248px] w-full rounded-[28px]" />

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold text-foreground md:text-base lg:text-sm">
                <SectionTitle>{content.filters}</SectionTitle>
              </h4>
              <Skeleton className="h-8 w-36 lg:h-6 lg:w-28" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
                {content.period}
              </Label>
              <Skeleton className="h-10 w-full rounded-md" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
                  {content.personas}
                </Label>
                <Skeleton className="h-8 w-20 lg:h-6 lg:w-16" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton
                    key={`persona-skeleton-${index}`}
                    className="h-12 w-full rounded-md lg:h-10"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
                  {content.models}
                </Label>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-8 w-16 lg:h-6 lg:w-12" />
                  <Skeleton className="h-8 w-28 lg:h-6 lg:w-24" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={`model-skeleton-${index}`}
                    className="h-[92px] w-full rounded-md"
                  />
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold leading-tight text-foreground md:text-base lg:text-sm">
                <SectionTitle>{content.topCompetitors}</SectionTitle>
              </h4>
              <Skeleton className="h-8 w-24 lg:h-6 lg:w-20" />
            </div>

            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={`competitor-skeleton-${index}`}
                  className="h-12 w-full rounded-md lg:h-10"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
