import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

import { MonitoringSectionTitle } from "../shared/monitoring-section-title";
import { FiltersEmptyStateCard } from "../shared/filters-empty-state-card";
import { ToggleMoreButton } from "./toggle-more-button";

const COMPETITORS_COUNT = 3;

type CompetitorFilterSectionProps = {
  competitors: Array<{ name: string; sov: number }>;
  selectedCompetitors: string[];
  toggleCompetitor: (name: string) => void;
  clearCompetitors: () => void;
  showAllCompetitors: boolean;
  setShowAllCompetitors: (value: boolean) => void;
};

export function CompetitorFilterSection({
  competitors,
  selectedCompetitors,
  toggleCompetitor,
  clearCompetitors,
  showAllCompetitors,
  setShowAllCompetitors,
}: CompetitorFilterSectionProps) {
  const content = useI18nScope("monitoring-filters-panel");
  const visibleCompetitors = showAllCompetitors
    ? competitors
    : competitors.slice(0, COMPETITORS_COUNT);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 text-sm font-semibold leading-tight text-foreground md:text-base lg:text-sm">
          <MonitoringSectionTitle>{content.topCompetitors}</MonitoringSectionTitle>
        </h4>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 min-w-[6.5rem] justify-center px-3 text-xs lg:h-6 lg:min-w-[5.25rem] lg:px-2",
            selectedCompetitors.length === 0 && "invisible pointer-events-none",
          )}
          onClick={clearCompetitors}
        >
          {content.clearCompetitors}
        </Button>
      </div>

      <div className="space-y-2">
        {visibleCompetitors.map((competitor) => {
          const isSelected = selectedCompetitors.includes(competitor.name);

          return (
            <label
              key={competitor.name}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-3 py-3 lg:py-2",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:bg-muted/30",
              )}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleCompetitor(competitor.name)}
              />
              <span className="min-w-0 flex-1 truncate text-sm md:text-[15px] lg:text-sm">
                {competitor.name}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground md:text-xs lg:text-[11px]">
                {competitor.sov.toFixed(1)}%
              </span>
            </label>
          );
        })}
      </div>

      {competitors.length === 0 ? (
        <FiltersEmptyStateCard label={content.noDataAvailable} />
      ) : null}
      {competitors.length > COMPETITORS_COUNT ? (
        <ToggleMoreButton
          showAll={showAllCompetitors}
          hiddenCount={competitors.length - COMPETITORS_COUNT}
          onToggle={() => setShowAllCompetitors(!showAllCompetitors)}
        />
      ) : null}
    </div>
  );
}
