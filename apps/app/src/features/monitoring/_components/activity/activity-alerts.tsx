"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { MonitoringData } from "@/lib/monitoring-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { MonitoringSectionTitle } from "../shared/monitoring-section-title";
import { FiltersEmptyStateCard } from "../shared/filters-empty-state-card";
import { getAlertTypeLabel } from "../../_lib/activity/activity-detail-helpers";

type MonitoringAlert = MonitoringData["alerts"][number];

type ActivityAlertsProps = {
  filteredAlerts: MonitoringAlert[];
  previewCount: number;
  onSelectAlert: (alert: MonitoringAlert) => void;
};

function getAlertTone(type: string) {
  if (type === "critical") {
    return { label: "text-destructive" };
  }
  return { label: "text-amber-700" };
}

export const ActivityAlerts = memo(function ActivityAlerts({ filteredAlerts, previewCount, onSelectAlert }: ActivityAlertsProps) {
  const content = useI18nScope("monitoring-activity-panel");
  const [showAll, setShowAll] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const visibleAlerts = showAll ? filteredAlerts : filteredAlerts.slice(0, previewCount);
  const hasData = filteredAlerts.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="min-w-0 text-sm font-semibold md:text-base">
            <MonitoringSectionTitle>{content.criticalUpdates}</MonitoringSectionTitle>
          </h4>
          <CollapsibleTrigger asChild>

              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
              />
        
          </CollapsibleTrigger>
        </div>
        <Badge variant="secondary" className="h-6 bg-primary/10 px-2 font-mono text-xs text-primary">
          {filteredAlerts.length}
        </Badge>
      </div>

      <CollapsibleContent className="space-y-3 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        {!hasData ? (
          <FiltersEmptyStateCard label={content.noDataAvailable} className="h-[120px] text-sm" />
        ) : (
          visibleAlerts.map((alert, index) => {
            const tone = getAlertTone(alert.type);
            return (
              <button
                type="button"
                key={`${alert.type}-${index}`}
                onClick={() => onSelectAlert(alert)}
                className={cn("group relative w-full overflow-hidden rounded-md bg-background p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40")}
                aria-label={`${content.criticalUpdates}: ${alert.msg}`}
              >
                <div className="mb-1 flex items-start justify-between">
                  <span className={cn("text-xs font-bold uppercase tracking-wider", tone.label)}>{alert.type}</span>
                  <span className="text-xs text-muted-foreground">{getAlertTypeLabel(alert.prompts, content) || alert.time}</span>
                </div>
                <p className="mb-2 text-xs font-medium leading-snug text-foreground md:text-sm">{alert.msg}</p>
                <div className="absolute bottom-2 right-2 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                  <ChevronRight className={cn("h-4 w-4", tone.label)} />
                </div>
              </button>
            );
          })
        )}

        {filteredAlerts.length > previewCount ? (
          <Button variant="ghost" size="sm" className="w-full text-xs md:text-sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? content.showLess : content.showMore}
          </Button>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
});
