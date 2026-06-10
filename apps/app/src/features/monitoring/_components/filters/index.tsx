import type { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/shared/date-range-picker";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import type { FilterHeroInsight } from "../../_lib/filters/filter-hero-insight";
import { useFiltersPanelViewModel } from "../../_lib/filters/use-filters-panel-view-model";
import { CompetitorFilterSection } from "./competitor-filter-section";
import { FilterHeroInsightCard } from "./filter-hero-insight-card";
import { Template } from "./template";
import { ModelFilterSection } from "./model-filter-section";

type FiltersPanelProps = {
  className?: string;
};

type FiltersPanelViewModel = {
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

export function FiltersPanel({ className }: FiltersPanelProps) {
  const {
    loading,
    project,
    period,
    setPeriod,
    dateRange,
    setDateRange,
    models,
    selectedModels,
    toggleModel,
    clearModels,
    selectedCompetitors,
    toggleCompetitor,
    clearCompetitors,
    showAllModels,
    setShowAllModels,
    showAllCompetitors,
    setShowAllCompetitors,
    onResetFilters,
    showResetFilters,
    showUniqueModelFilters,
    onModelFilterModeChange,
    heroInsight,
  }: FiltersPanelViewModel = useFiltersPanelViewModel();

  const content = useI18nScope("monitoring-filters-panel");

  if (loading) {
    return <Template />;
  }

  const resetButtonClassName = cn(
    "h-8 min-w-[9rem] justify-center px-3 text-xs lg:h-6 lg:min-w-[7.5rem] lg:px-2 lg:text-xs",
    !showResetFilters && "pointer-events-none invisible",
  );

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 no-scrollbar lg:min-h-0 lg:p-2">
        <div className="flex flex-col gap-5 pb-4">
          <FilterHeroInsightCard insight={heroInsight} />

          <div className="space-y-6">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold text-foreground md:text-base lg:text-sm">
                <SectionTitle>{content.filters}</SectionTitle>
              </h4>

              <Button
                variant="ghost"
                size="sm"
                className={resetButtonClassName}
                onClick={onResetFilters}
              >
                {content.resetFilters}
              </Button>
            </div>

            <div className="space-y-4">
              <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
                {content.period}
              </Label>

              <DatePickerWithRange
                date={dateRange}
                setDate={setDateRange}
                period={period}
                setPeriod={setPeriod}
              />
            </div>

            {/* Persona filters are intentionally paused for now. */}
            {/* <PersonaFilterSection
              personaOptions={personaOptions}
              selectedPersonas={selectedPersonas}
              togglePersona={togglePersona}
              clearPersonas={clearPersonas}
              showAllPersonas={showAllPersonas}
              setShowAllPersonas={setShowAllPersonas}
            /> */}

            <ModelFilterSection
              models={models}
              selectedModels={selectedModels}
              toggleModel={toggleModel}
              clearModels={clearModels}
              showAllModels={showAllModels}
              setShowAllModels={setShowAllModels}
              showUniqueModelFilters={showUniqueModelFilters}
              onModelFilterModeChange={onModelFilterModeChange}
            />
          </div>

          <Separator />

          <CompetitorFilterSection
            competitors={project.competitors}
            selectedCompetitors={selectedCompetitors}
            toggleCompetitor={toggleCompetitor}
            clearCompetitors={clearCompetitors}
            showAllCompetitors={showAllCompetitors}
            setShowAllCompetitors={setShowAllCompetitors}
          />
        </div>
      </div>
    </div>
  );
}
