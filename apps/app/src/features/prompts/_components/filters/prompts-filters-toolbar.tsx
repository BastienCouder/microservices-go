"use client";

import { useState } from "react";
import { DateRange } from "react-day-picker";
import { ChevronDown, SlidersHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { DatePickerWithRange } from "@/components/shared/date-range-picker";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
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
}: PromptsFiltersToolbarProps) {
  const content = useI18nScope("prompts-workspace");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showResponsesPeriodFilter = currentTab === "responses";

  const filtersContent = (
    <>
      <div className="relative w-full min-w-0 sm:min-w-[260px] sm:flex-1 lg:max-w-[480px]">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10 pl-11 text-sm"
          placeholder={content.searchPromptsPlaceholder}
        />
      </div>

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

      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-pressed={showArchived}
        className={cn(
          "h-8 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
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
          className="h-10 justify-center rounded-full px-4 text-xs"
          onClick={clearFilters}
        >
          {content.clearAll}
        </Button>
      )}
    </>
  );

  return (
    <>
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mt-5 md:hidden">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="flex h-11 w-full items-center justify-between rounded-2xl px-4"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4" />
              {content.filters}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="mt-3 flex flex-col gap-2">{filtersContent}</div>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-5 hidden flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center">
        {filtersContent}
      </div>
    </>
  );
}
