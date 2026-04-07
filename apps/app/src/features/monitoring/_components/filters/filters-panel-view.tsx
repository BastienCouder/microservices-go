import type { DateRange } from "react-day-picker";

import { DatePickerWithRange } from "@/components/monitoring/date-range-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

import { MonitoringSectionTitle } from "../shared/monitoring-section-title";
import { CompetitorFilterSection } from "./competitor-filter-section";
import { FilterHeroInsightCard } from "./filter-hero-insight-card";
import { FiltersPanelLoading } from "./filters-panel-loading";
import { ModelFilterSection } from "./model-filter-section";
import type { FilterHeroInsight } from "../../_lib/filters/filter-hero-insight";

type FiltersPanelViewProps = {
  loading: boolean;
  project: {
    competitors: Array<{ name: string; sov: number }>;
  };
  period: string;
  setPeriod: (value: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (value: DateRange | undefined) => void;
  personaOptions: Array<{ id: string; label: string }>;
  selectedPersonas: string[];
  togglePersona: (id: string) => void;
  clearPersonas: () => void;
  models: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    live: boolean;
    modelGroup: string;
  }>;
  selectedModels: string[];
  toggleModel: (id: string) => void;
  clearModels: () => void;
  selectedCompetitors: string[];
  toggleCompetitor: (name: string) => void;
  clearCompetitors: () => void;
  showAllModels: boolean;
  setShowAllModels: (value: boolean) => void;
  showAllPersonas: boolean;
  setShowAllPersonas: (value: boolean) => void;
  showAllCompetitors: boolean;
  setShowAllCompetitors: (value: boolean) => void;
  onResetFilters: () => void;
  showResetFilters: boolean;
  showUniqueModelFilters: boolean;
  onModelFilterModeChange: (value: boolean) => void;
  heroInsight: FilterHeroInsight;
};

export function FiltersPanelView(props: FiltersPanelViewProps) {
  const content = useI18nScope("monitoring-filters-panel");

  if (props.loading) {
    return <FiltersPanelLoading />;
  }

  return (
    <div className="flex h-auto flex-col lg:h-full">
      <div className="min-h-0 flex-1 overflow-y-auto p-2 no-scrollbar lg:min-h-0 lg:p-2">
        <div className="flex flex-col gap-5 pb-4">
          <FilterHeroInsightCard insight={props.heroInsight} />

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold text-foreground md:text-base lg:text-sm">
                <MonitoringSectionTitle>{content.filters}</MonitoringSectionTitle>
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 min-w-[9rem] justify-center px-3 text-xs lg:h-6 lg:min-w-[7.5rem] lg:px-2 lg:text-[10px]",
                  !props.showResetFilters && "invisible pointer-events-none",
                )}
                onClick={props.onResetFilters}
              >
                {content.resetFilters}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
                {content.period}
              </Label>
              <DatePickerWithRange
                date={props.dateRange}
                setDate={props.setDateRange}
                period={props.period}
                setPeriod={props.setPeriod}
              />
            </div>

            {/* Persona filters are intentionally paused for now. */}
            {/* <PersonaFilterSection
              personaOptions={props.personaOptions}
              selectedPersonas={props.selectedPersonas}
              togglePersona={props.togglePersona}
              clearPersonas={props.clearPersonas}
              showAllPersonas={props.showAllPersonas}
              setShowAllPersonas={props.setShowAllPersonas}
            /> */}

            <ModelFilterSection
              models={props.models}
              selectedModels={props.selectedModels}
              toggleModel={props.toggleModel}
              clearModels={props.clearModels}
              showAllModels={props.showAllModels}
              setShowAllModels={props.setShowAllModels}
              showUniqueModelFilters={props.showUniqueModelFilters}
              onModelFilterModeChange={props.onModelFilterModeChange}
            />
          </div>

          <Separator />

          <CompetitorFilterSection
            competitors={props.project.competitors}
            selectedCompetitors={props.selectedCompetitors}
            toggleCompetitor={props.toggleCompetitor}
            clearCompetitors={props.clearCompetitors}
            showAllCompetitors={props.showAllCompetitors}
            setShowAllCompetitors={props.setShowAllCompetitors}
          />
        </div>
      </div>
    </div>
  );
}
