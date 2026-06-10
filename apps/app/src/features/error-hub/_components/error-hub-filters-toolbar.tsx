import {
  PeriodFilterPicker,
} from "@/components/shared/period-filter-picker";
import { ResponsiveFiltersToolbar } from "@/components/shared/responsive-filters-toolbar";
import { Button } from "@/components/ui/button";
import type { ProjectModelMeta } from "@/lib/project-models";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

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
  const { t } = useScopedI18n("error-hub");
  const periodOptions = PERIOD_OPTIONS.map((option) => ({
    ...option,
    label: t(`periodOption${option.value === "all" ? "All" : option.value.toUpperCase()}`),
  }));
  const actionStatusOptions = ACTION_STATUS_OPTIONS.map((option) => ({
    ...option,
    label:
      option.value === "all"
        ? t("actionStatusAll")
        : option.value === "processing"
          ? t("actionStatusProcessing")
          : t("actionStatusDone"),
  }));
  const sourceOptions = SOURCE_OPTIONS.map((option) => ({
    ...option,
    label:
      option.value === "all"
        ? t("sourceAll")
        : option.value === "crawler"
          ? t("sourceCrawler")
          : option.value === "perception"
            ? t("sourcePerception")
            : t("sourceMonitoring"),
  }));

  const renderFilters = () => (
    <>
      <ErrorHubSearchFilter
        search={props.search}
        onSearchChange={props.setSearch}
      />

      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={props.period}
        onValueChange={(value) => props.setPeriod(value as PeriodFilter)}
        options={periodOptions}
        label={t("periodLabel")}
        title={t("periodLabel")}
      />

      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={props.actionStatusFilter}
        onValueChange={(value) =>
          props.setActionStatusFilter(value as ActionStatusFilter)
        }
        options={actionStatusOptions}
        label={t("statusLabel")}
        title={t("statusLabel")}
      />

      <PeriodFilterPicker
        className="w-full sm:w-[220px]"
        value={props.sourceFilter}
        onValueChange={(value) => props.setSourceFilter(value as SourceFilter)}
        options={sourceOptions}
        label={t("sourceLabel")}
        title={t("sourceLabel")}
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
          className="h-10 justify-center rounded-lg px-4 text-xs"
          onClick={props.clearFilters}
        >
          {t("resetFilters")}
        </Button>
      ) : null}
    </>
  );

  return (
    <ResponsiveFiltersToolbar label={t("filtersLabel")}>
      {renderFilters}
    </ResponsiveFiltersToolbar>
  );
}
