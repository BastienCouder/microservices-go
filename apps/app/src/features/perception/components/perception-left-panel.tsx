"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { ModelFilterModeTabs } from "@/components/monitoring/model-filter-mode-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonitoringSectionTitle } from "@/features/monitoring/_components/shared/monitoring-section-title";
import { FiltersEmptyStateCard } from "@/features/monitoring/_components/shared/filters-empty-state-card";
import { ModelCard } from "@/features/monitoring/_components/shared/model-card";
import { getModelGroupForName, getModelIconForName, PERCEPTION_PERIOD_LABELS, PERCEPTION_TEXT } from "@/lib/app-data";
import type { BrandCanon, PerceptionTrendPeriodKey, PerceptionViewData } from "@/lib/perception-data";
import { cn } from "@/lib/utils";
import { BrandCanonSummary } from "./brand-canon-summary";

const MODELS_COUNT = 4;

type ModelFilterItem = {
  id: string;
  displayName: string;
  groupName: string;
  iconPath: string;
  memberNames: string[];
};

export function PerceptionLeftPanel({
  canon,
  source,
  windowLabel,
  analyzedResponses,
  selectedModels,
  modelOptions,
  selectedPeriod,
  onModelToggle,
  onResetModels,
  onPeriodChange,
  showAllModels,
  onToggleShowAllModels,
  showUniqueModelFilters,
  onToggleModelFilterMode,
  isDemo,
}: {
  canon: BrandCanon;
  source: PerceptionViewData["source"];
  windowLabel: string;
  analyzedResponses: number;
  selectedModels: string[];
  modelOptions: string[];
  selectedPeriod: PerceptionTrendPeriodKey;
  onModelToggle: (value: string) => void;
  onResetModels: () => void;
  onPeriodChange: (value: PerceptionTrendPeriodKey) => void;
  showAllModels: boolean;
  onToggleShowAllModels: () => void;
  showUniqueModelFilters: boolean;
  onToggleModelFilterMode: (value: boolean) => void;
  isDemo: boolean;
}) {
  const location = useLocation();
  const brandEditSearch = useMemo(() => {
    const params = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    params.set("tab", "brand");
    const search = params.toString();
    return search ? `?${search}` : "";
  }, [location.search]);

  return (
    <div className="flex h-auto flex-col xl:h-full">
      <div className="m-2 mb-4 shrink-0 rounded-md bg-primary p-4 text-primary-foreground">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="mt-1 leading-tight">
              <MonitoringSectionTitle className="text-primary-foreground [&>span:first-child]:text-primary-foreground">
                {PERCEPTION_TEXT.leftPanel.title}
              </MonitoringSectionTitle>
            </h4>
            <p className="mt-3 text-xs text-primary-foreground/85">{PERCEPTION_TEXT.leftPanel.helper}</p>
          </div>
          <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
            {source === "project"
              ? PERCEPTION_TEXT.leftPanel.source.project
              : source === "fallback"
                ? PERCEPTION_TEXT.leftPanel.source.fallback
                : PERCEPTION_TEXT.leftPanel.source.demo}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
            {windowLabel}
          </Badge>
          <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
            {analyzedResponses} {PERCEPTION_TEXT.leftPanel.responsesLabel}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="brand" className="min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-2 pb-2">
          <TabsList className="h-9 w-full">
            <TabsTrigger value="brand">{PERCEPTION_TEXT.leftPanel.tabs.brand}</TabsTrigger>
            <TabsTrigger value="filters">{PERCEPTION_TEXT.leftPanel.tabs.filters}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="brand" className="m-0 min-h-0 flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
          <div className="mb-3 flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link to={{ pathname: "/perception/brand-canon", search: brandEditSearch }}>
                Modifier la marque
              </Link>
            </Button>
          </div>
          <BrandCanonSummary canon={canon} isDemo={isDemo} />
        </TabsContent>

        <TabsContent value="filters" className="m-0 min-h-0 flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
          <PerceptionFiltersPanel
            modelOptions={modelOptions}
            selectedModels={selectedModels}
            selectedPeriod={selectedPeriod}
            onModelToggle={onModelToggle}
            onResetModels={onResetModels}
            onPeriodChange={onPeriodChange}
            showAllModels={showAllModels}
            onToggleShowAllModels={onToggleShowAllModels}
            showUniqueModelFilters={showUniqueModelFilters}
            onToggleModelFilterMode={onToggleModelFilterMode}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PerceptionFiltersPanel({
  modelOptions,
  selectedModels,
  selectedPeriod,
  onModelToggle,
  onResetModels,
  onPeriodChange,
  showAllModels,
  onToggleShowAllModels,
  showUniqueModelFilters,
  onToggleModelFilterMode,
}: {
  modelOptions: string[];
  selectedModels: string[];
  selectedPeriod: PerceptionTrendPeriodKey;
  onModelToggle: (value: string) => void;
  onResetModels: () => void;
  onPeriodChange: (value: PerceptionTrendPeriodKey) => void;
  showAllModels: boolean;
  onToggleShowAllModels: () => void;
  showUniqueModelFilters: boolean;
  onToggleModelFilterMode: (value: boolean) => void;
}) {
  const groupedFilterItems = useMemo<ModelFilterItem[]>(() => {
    const groups = new Map<string, ModelFilterItem>();

    for (const modelName of modelOptions) {
      const groupName = getModelGroupForName(modelName);
      const current = groups.get(groupName);
      if (!current) {
        groups.set(groupName, {
          id: groupName,
          displayName: "",
          groupName,
          iconPath: getModelIconForName(modelName),
          memberNames: [modelName],
        });
        continue;
      }
      current.memberNames.push(modelName);
    }

    return Array.from(groups.values());
  }, [modelOptions]);

  const visibleModelFilterItems = useMemo<ModelFilterItem[]>(
    () =>
      showUniqueModelFilters
        ? modelOptions.map((modelName) => ({
            id: modelName,
            displayName: modelName,
            groupName: getModelGroupForName(modelName),
            iconPath: getModelIconForName(modelName),
            memberNames: [modelName],
          }))
        : groupedFilterItems,
    [groupedFilterItems, modelOptions, showUniqueModelFilters],
  );

  const selectedModelFilterIds = useMemo(() => {
    if (showUniqueModelFilters) return selectedModels;
    return visibleModelFilterItems
      .filter((item) => item.memberNames.every((name) => selectedModels.includes(name)))
      .map((item) => item.id);
  }, [selectedModels, showUniqueModelFilters, visibleModelFilterItems]);

  const visibleModels = showAllModels
    ? visibleModelFilterItems
    : visibleModelFilterItems.slice(0, MODELS_COUNT);

  const toggleModelFilter = (filterId: string) => {
    const item = visibleModelFilterItems.find((entry) => entry.id === filterId);
    if (!item) return;

    const allSelected = item.memberNames.every((name) => selectedModels.includes(name));
    if (allSelected) {
      item.memberNames
        .filter((name) => selectedModels.includes(name))
        .forEach((name) => onModelToggle(name));
      return;
    }

    item.memberNames
      .filter((name) => !selectedModels.includes(name))
      .forEach((name) => onModelToggle(name));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground md:text-sm xl:text-xs">{PERCEPTION_TEXT.filters.period}</label>
        <Select value={selectedPeriod} onValueChange={(value) => onPeriodChange(value as PerceptionTrendPeriodKey)}>
          <SelectTrigger className="h-10 w-full bg-background lg:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="item-aligned">
            <SelectItem value="all">{PERCEPTION_PERIOD_LABELS.all}</SelectItem>
            <SelectItem value="7d">{PERCEPTION_PERIOD_LABELS["7d"]}</SelectItem>
            <SelectItem value="30d">{PERCEPTION_PERIOD_LABELS["30d"]}</SelectItem>
            <SelectItem value="90d">{PERCEPTION_PERIOD_LABELS["90d"]}</SelectItem>
            <SelectItem value="last-run">{PERCEPTION_PERIOD_LABELS["last-run"]}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-muted-foreground md:text-sm xl:text-xs">{PERCEPTION_TEXT.filters.models}</label>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 min-w-[4.5rem] justify-center px-3 text-xs lg:h-6 lg:min-w-[4rem] lg:px-2 lg:text-[10px]",
                selectedModels.length === 0 && "invisible pointer-events-none",
              )}
              onClick={onResetModels}
            >
              {PERCEPTION_TEXT.filters.clear}
            </Button>
          </div>
        </div>

        <ModelFilterModeTabs
          value={showUniqueModelFilters ? "unique" : "grouped"}
          onValueChange={(value) => onToggleModelFilterMode(value === "unique")}
          groupedLabel={PERCEPTION_TEXT.filters.groupedMode}
          uniqueLabel={PERCEPTION_TEXT.filters.uniqueMode}
        />

        {modelOptions.length === 0 ? (
          <FiltersEmptyStateCard label={PERCEPTION_TEXT.filters.noModels} />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {visibleModels.map((model) => (
              <ModelCard
                key={model.id}
                name={showUniqueModelFilters ? model.displayName : ""}
                description=""
                icon={model.iconPath}
                selected={selectedModelFilterIds.includes(model.id)}
                onClick={() => toggleModelFilter(model.id)}
                modelGroup={model.groupName}
              />
            ))}
          </div>
        )}

        {visibleModelFilterItems.length > MODELS_COUNT ? (
          <Button
            variant="ghost"
            className="h-auto min-h-7 w-full whitespace-normal py-1 text-xs leading-tight text-muted-foreground hover:text-foreground"
            onClick={onToggleShowAllModels}
          >
            {showAllModels ? (
              <>
                {PERCEPTION_TEXT.filters.showLess} <ChevronUp className="ml-1 h-3 w-3" />
              </>
            ) : (
              <>
                {PERCEPTION_TEXT.filters.showMore} ({visibleModelFilterItems.length - MODELS_COUNT}){" "}
                <ChevronDown className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
