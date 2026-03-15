import { memo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useI18nScope } from "@/shared/hooks/use-i18n";

import { FiltersPanel } from "../filters/filters-panel";
import { MonitoringSectionTitle } from "../shared/monitoring-section-title";
import {
  getActiveMonitoringFilterCount,
  useMonitoringFilters,
} from "../../_lib/shared/use-monitoring-filters";

export const MobileFiltersBar = memo(function MobileFiltersBar() {
  const [open, setOpen] = useState(false);
  const content = useI18nScope("monitoring-filters-panel");
  const filters = useMonitoringFilters();
  const activeFilterCount = getActiveMonitoringFilterCount(filters);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="flex h-11 w-full items-center justify-between rounded-2xl border-border/60 bg-background px-4 text-sm font-medium"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              {content.filters}
            </span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>

        <SheetContent
          side="bottom"
          className="h-[85dvh] rounded-t-[28px] border-t border-border/60 p-0"
        >
          <SheetHeader className="border-b border-border/60 bg-background px-4 py-4">
            <SheetTitle>
              <MonitoringSectionTitle>{content.filters}</MonitoringSectionTitle>
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-2 pb-4 pt-2">
            <FiltersPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
});
