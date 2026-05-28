"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { ResponsiveFiltersToolbar } from "@/components/shared/responsive-filters-toolbar";
import { SearchFilterInput } from "@/components/shared/search-filter-input";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/shared/date-range-picker";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { CompetitorsFilterPopover } from "./competitors-filter-popover";
import { ModelsFilterPopover } from "./models-filter-popover";

type ModelVisual = {
  icon: string;
  description: string;
  label: string;
  provider: string;
  name: string;
};

type PromptsFiltersToolbarProps = {
  currentTab: "prompts" | "responses";
  period: string;
  setPeriod: (period: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  persona: string;
  setPersona: (persona: string) => void;
  availablePersonas: string[];
  search: string;
  setSearch: (value: string) => void;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
  hasActiveGlobalFilters: boolean;
  clearFilters: () => void;
  modelsPopoverOpen: boolean;
  setModelsPopoverOpen: (open: boolean) => void;
  allModelsSelected: boolean;
  selectedModels: string[];
  availableModels: string[];
  modelsLoading?: boolean;
  getModelVisual: (model: string) => ModelVisual;
  toggleModel: (model: string) => void;
  selectedCompetitors: string[];
  toggleCompetitor: (value: string) => void;
  clearCompetitors: () => void;
  availableCompetitors: string[];
  competitorsLoading?: boolean;
};

export function PromptsFiltersToolbar({
  currentTab,
  period,
  setPeriod,
  dateRange,
  setDateRange,
  search,
  setSearch,
  showArchived,
  setShowArchived,
  hasActiveGlobalFilters,
  clearFilters,
  modelsPopoverOpen,
  setModelsPopoverOpen,
  allModelsSelected,
  selectedModels,
  availableModels,
  modelsLoading = false,
  getModelVisual,
  toggleModel,
  selectedCompetitors,
  toggleCompetitor,
  clearCompetitors,
  availableCompetitors,
  competitorsLoading = false,
}: PromptsFiltersToolbarProps) {
  const content = useI18nScope("prompts-workspace");
  const [competitorsPopoverOpen, setCompetitorsPopoverOpen] = useState(false);
  const showResponsesPeriodFilter = currentTab === "responses";

  const renderFilters = () => (
    <>
      <SearchFilterInput
        value={search}
        onValueChange={setSearch}
        placeholder={content.searchPromptsPlaceholder}
        className="w-full min-w-0 sm:min-w-[260px] sm:flex-1 lg:max-w-[480px]"
      />

      {showResponsesPeriodFilter ? (
        <DatePickerWithRange
          className="w-full sm:w-[220px]"
          date={dateRange}
          setDate={setDateRange}
          period={period}
          setPeriod={setPeriod}
          includeAll
        />
      ) : null}

      <ModelsFilterPopover
        open={modelsPopoverOpen}
        onOpenChange={setModelsPopoverOpen}
        allModelsSelected={allModelsSelected}
        selectedModels={selectedModels}
        availableModels={availableModels}
        loading={modelsLoading}
        getModelVisual={getModelVisual}
        toggleModel={toggleModel}
      />

      {currentTab === "responses" ? (
        <CompetitorsFilterPopover
          open={competitorsPopoverOpen}
          onOpenChange={setCompetitorsPopoverOpen}
          selectedCompetitors={selectedCompetitors}
          toggleCompetitor={toggleCompetitor}
          clearCompetitors={clearCompetitors}
          availableCompetitors={availableCompetitors}
          loading={competitorsLoading}
        />
      ) : null}

      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-pressed={showArchived}
        className={cn(
          "h-8 shrink-0 rounded-lg px-4 text-sm font-medium transition-colors",
          showArchived
            ? "border-primary bg-primary/10 text-primary"
            : "border-border/80 text-foreground hover:border-primary hover:bg-primary/10 hover:text-primary",
        )}
        onClick={() => setShowArchived(!showArchived)}
        title={content.archivedPromptsHelp}
      >
        <span>{content.showArchivedPrompts}</span>
      </Button>

      {hasActiveGlobalFilters && (
        <Button
          size="xs"
          variant="ghost"
          className="h-10 justify-center rounded-lg px-4 text-xs"
          onClick={clearFilters}
        >
          {content.clearAll}
        </Button>
      )}
    </>
  );

  return (
    <ResponsiveFiltersToolbar label={content.filters}>
      {renderFilters}
    </ResponsiveFiltersToolbar>
  );
}
