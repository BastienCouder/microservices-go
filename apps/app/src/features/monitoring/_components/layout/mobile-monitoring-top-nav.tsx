"use client";

import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type MobileMonitoringTopNavProps = {
  projectName: string;
  periodLabel: string;
  activeFilterCount: number;
  onOpenFilters: () => void;
};

export function MobileMonitoringTopNav({
  projectName,
  periodLabel,
  activeFilterCount,
  onOpenFilters,
}: MobileMonitoringTopNavProps) {
  const content = useI18nScope("monitoring-mobile");

  return (
    <div className="fixed inset-x-0 top-0 z-40 border-b border-white/60 bg-white/65 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-3 pb-3 pt-[calc(0.85rem+env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {content.monitoringMobile}
          </p>
          <p className="truncate text-sm font-semibold text-slate-950">
            {projectName || content.yourMonitoring}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-medium text-white">
            {periodLabel}
          </div>

          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 rounded-full border-white/70 bg-white/75 px-3 shadow-sm backdrop-blur-sm",
              activeFilterCount > 0 && "border-primary/30 bg-primary/5 text-primary",
            )}
            onClick={onOpenFilters}
            aria-label={content.filters}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {content.filters}
            {activeFilterCount > 0 ? (
              <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
