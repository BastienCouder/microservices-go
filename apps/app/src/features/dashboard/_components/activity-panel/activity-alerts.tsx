"use client";

import { memo } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { FiltersEmptyStateCard } from "../filters-panel/filters-empty-state-card";

type DashboardAlert = DashboardData["alerts"][number];

type ActivityAlertsProps = {
  filteredAlerts: DashboardAlert[];
  previewCount: number;
  onSelectAlert: (alert: DashboardAlert) => void;
};

function getAlertTypeLabel(value?: string) {
  const key = (value || "").trim().toLowerCase();
  if (!key) return "";
  const map: Record<string, string> = {
    visibility_drop: "Baisse de visibilite",
    competitor_surge: "Concurrence en hausse",
    ranking_loss: "Perte de position",
    sentiment_drop: "Baisse de sentiment",
    factual_error_spike: "Hausse des erreurs factuelles",
    mention_drop: "Baisse des mentions",
    citation_drop: "Baisse des citations",
    pricing_mismatch: "Decalage pricing",
  };
  return map[key] || key.replace(/_/g, " ");
}

function getAlertTone(type: string) {
  if (type === "critical") {
    return { label: "text-destructive" };
  }
  return { label: "text-amber-700" };
}

export const ActivityAlerts = memo(function ActivityAlerts({ filteredAlerts, previewCount, onSelectAlert }: ActivityAlertsProps) {
  const content = useI18nScope("dashboard-activity-panel");
  const visibleAlerts = filteredAlerts.slice(0, previewCount);
  const hasData = filteredAlerts.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{content.criticalUpdates}</h4>
        </div>
        <Badge variant="secondary" className="h-5 bg-primary/10 px-1.5 font-mono text-[10px] text-primary">
          {filteredAlerts.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {!hasData ? (
          <FiltersEmptyStateCard label={content.noDataAvailable} className="h-[120px] text-sm" />
        ) : (
          visibleAlerts.map((alert, index) => {
          const tone = getAlertTone(alert.type);
          return (
            <div
              key={`${alert.type}-${index}`}
              onClick={() => onSelectAlert(alert)}
              className={cn("group relative cursor-pointer overflow-hidden rounded-md bg-background p-3 transition-all")}
            >
              <div className="mb-1 flex items-start justify-between">
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", tone.label)}>{alert.type}</span>
                <span className="text-[10px] text-muted-foreground">{getAlertTypeLabel(alert.prompts) || alert.time}</span>
              </div>
              <p className="mb-2 text-xs font-medium leading-snug text-foreground">{alert.msg}</p>
              <div className="absolute bottom-2 right-2 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <ChevronRight className={cn("h-4 w-4", tone.label)} />
              </div>
            </div>
          );
          })
        )}

        {filteredAlerts.length > previewCount ? (
          <Button variant="ghost" size="sm" className="w-full text-xs">
            {content.showMore}
          </Button>
        ) : null}
      </div>
    </div>
  );
});
