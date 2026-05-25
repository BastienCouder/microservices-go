import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

import {
  PeriodFilterPicker,
} from "@/components/shared/period-filter-picker";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ProjectModelMeta } from "@/lib/project-models";
import { cn } from "@/lib/utils";

import { ErrorHubCompetitorsFilter } from "./filters/error-hub-competitors-filter";
import { ErrorHubModelsFilter } from "./filters/error-hub-models-filter";
import { ErrorHubSearchFilter } from "./filters/error-hub-search-filter";
import {
  ACTION_STATUS_OPTIONS,
  PERIOD_OPTIONS,
  SOURCE_OPTIONS,
  type ActionStatusFilter,
  type PeriodFilter,
  type SourceFilter,
} from "../_lib/error-hub-types";

type ErrorHubFiltersToolbarProps = {
  actionStatusFilter: ActionStatusFilter;
  allCompetitorsSelected: boolean;
  allModelsSelected: boolean;
  availableCompetitors: string[];
  availableModels: string[];
  clearFilters: () => void;
  competitorsPopoverOpen: boolean;
  hasActiveFilters: boolean;
  modelsPopoverOpen: boolean;
  period: PeriodFilter;
  projectModelLookup: ReadonlyMap<string, ProjectModelMeta>;
  search: string;
  selectedCompetitors: string[];
  selectedModels: string[];
  setActionStatusFilter: (status: ActionStatusFilter) => void;
  setCompetitorsPopoverOpen: (open: boolean) => void;
  setModelsPopoverOpen: (open: boolean) => void;
  setPeriod: (period: PeriodFilter) => void;
  setSearch: (value: string) => void;
  setSourceFilter: (source: SourceFilter) => void;
  sourceFilter: SourceFilter;
  toggleCompetitor: (competitor: string) => void;
  toggleModel: (model: string) => void;
};

export function ErrorHubFiltersToolbar(props: ErrorHubFiltersToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtersContent = (
    <>
      <ErrorHubSearchFilter
        search={props.search}
        onSearchChange={props.setSearch}
      />

      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={props.period}
        onValueChange={(value) => props.setPeriod(value as PeriodFilter)}
        options={PERIOD_OPTIONS}
        label="Période"
        title="Période"
        description="Filtrer les erreurs par période."
      />

      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={props.actionStatusFilter}
        onValueChange={(value) =>
          props.setActionStatusFilter(value as ActionStatusFilter)
        }
        options={ACTION_STATUS_OPTIONS}
        label="Statut"
        title="Statut"
        description="Afficher les actions en cours ou terminées."
      />

      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={props.sourceFilter}
        onValueChange={(value) => props.setSourceFilter(value as SourceFilter)}
        options={SOURCE_OPTIONS}
        label="Source"
        title="Source"
        description="Filtrer les erreurs par origine."
      />

      <ErrorHubModelsFilter
        open={props.modelsPopoverOpen}
        onOpenChange={props.setModelsPopoverOpen}
        allModelsSelected={props.allModelsSelected}
        projectModelLookup={props.projectModelLookup}
        selectedModels={props.selectedModels}
        availableModels={props.availableModels}
        toggleModel={props.toggleModel}
      />

      <ErrorHubCompetitorsFilter
        open={props.competitorsPopoverOpen}
        onOpenChange={props.setCompetitorsPopoverOpen}
        allCompetitorsSelected={props.allCompetitorsSelected}
        selectedCompetitors={props.selectedCompetitors}
        availableCompetitors={props.availableCompetitors}
        toggleCompetitor={props.toggleCompetitor}
      />

      {props.hasActiveFilters ? (
        <Button
          size="xs"
          variant="ghost"
          className="h-10 justify-center rounded-full px-4 text-xs"
          onClick={props.clearFilters}
        >
          Réinitialiser
        </Button>
      ) : null}
    </>
  );

  return (
    <>
      <Collapsible
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        className="mt-5 md:hidden"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="flex h-11 w-full items-center justify-between rounded-2xl px-4"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                filtersOpen && "rotate-180",
              )}
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