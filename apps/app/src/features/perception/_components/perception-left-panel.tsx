"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { BooleanModelFilterModeTabs } from "@/components/shared/model-filter-mode-tabs";
import { PeriodFilterPicker } from "@/components/shared/period-filter-picker";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { ModelCard } from "@/components/shared/model-card";
import type {
  BrandCanon,
  PerceptionModelOption,
  PerceptionTrendPeriodKey,
  PerceptionViewData,
} from "@/lib/perception-data";
import {
  buildProjectModelFilterItems,
  buildSelectedProjectModelFilterIds,
  type ProjectModelFilterItem,
} from "@/lib/project-models";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  buildPerceptionHeroInsight,
  buildPerceptionPeriodOptions,
} from "../_lib";
import { BrandCanonSummary } from "./brand-canon-summary";
import { PerceptionHeroInsightCard } from "./perception-hero-insight-card";

const MODELS_COUNT = 4;

export function PerceptionLeftPanel({
  canon,
  radar,
  trendData,
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
  radar: PerceptionViewData["radar"];
  trendData: PerceptionViewData["trend"][PerceptionTrendPeriodKey]["data"];
  windowLabel: string;
  analyzedResponses: number;
  selectedModels: string[];
  modelOptions: PerceptionModelOption[];
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
  const { locale, t } = useScopedI18n("perception");
  const location = useLocation();
  const brandEditSearch = useMemo(() => {
    const params = new URLSearchParams(location.search.startsWith("?") ? location.search.slice(1) : location.search);
    params.set("tab", "brand");
    const search = params.toString();
    return search ? `?${search}` : "";
  }, [location.search]);
  const heroInsight = useMemo(
    () =>
      buildPerceptionHeroInsight(
        radar,
        trendData,
        {
          windowLabel,
          analyzedResponses,
        },
        locale,
      ),
    [analyzedResponses, locale, radar, trendData, windowLabel],
  );

  return (
    <div className="flex h-auto flex-col xl:h-full">
      <div className="m-2 mb-4 shrink-0">
        <PerceptionHeroInsightCard insight={heroInsight} />
      </div>

      <Tabs defaultValue="brand" className="min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-2 pb-2">
          <TabsList className="h-9 w-full">
            <TabsTrigger value="brand">{t("leftPanelTabBrand")}</TabsTrigger>
            <TabsTrigger value="filters">{t("leftPanelTabFilters")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="brand" className="m-0 min-h-0 flex-1 overflow-y-auto px-2 pb-4 no-scrollbar">
          <BrandCanonSummary
            canon={canon}
            isDemo={isDemo}
            action={
              <Button asChild variant="outline" className="w-full justify-center rounded-lg">
                <Link to={{ pathname: "/perception/brand-canon", search: brandEditSearch }}>
                  {t("leftPanelChangeBrand")}
                </Link>
              </Button>
            }
          />
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
  modelOptions: PerceptionModelOption[];
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
  const { locale, t } = useScopedI18n("perception");
  const visibleModelFilterItems = useMemo<ProjectModelFilterItem[]>(
    () => buildProjectModelFilterItems(modelOptions, showUniqueModelFilters),
    [modelOptions, showUniqueModelFilters],
  );

  const selectedModelFilterIds = useMemo(
    () =>
      buildSelectedProjectModelFilterIds(
        selectedModels,
        visibleModelFilterItems,
        showUniqueModelFilters,
      ),
    [selectedModels, showUniqueModelFilters, visibleModelFilterItems],
  );

  const visibleModels = showAllModels
    ? visibleModelFilterItems
    : visibleModelFilterItems.slice(0, MODELS_COUNT);

  const toggleModelFilter = (filterId: string) => {
    const item = visibleModelFilterItems.find((entry) => entry.id === filterId);
    if (!item) return;

    const allSelected = item.memberIds.every((id) => selectedModels.includes(id));
    if (allSelected) {
      item.memberIds
        .filter((id) => selectedModels.includes(id))
        .forEach((id) => onModelToggle(id));
      return;
    }

    item.memberIds
      .filter((id) => !selectedModels.includes(id))
      .forEach((id) => onModelToggle(id));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground md:text-sm xl:text-xs">{t("filtersPeriod")}</label>
        <PeriodFilterPicker
          value={selectedPeriod}
          onValueChange={(value) => onPeriodChange(value as PerceptionTrendPeriodKey)}
          options={buildPerceptionPeriodOptions(locale)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-muted-foreground md:text-sm xl:text-xs">{t("filtersModels")}</label>
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
              {t("filtersClear")}
            </Button>
          </div>
        </div>

        <BooleanModelFilterModeTabs
          showUniqueModelFilters={showUniqueModelFilters}
          onShowUniqueModelFiltersChange={onToggleModelFilterMode}
        />

        {modelOptions.length === 0 ? (
          <EmptyStateCard label={t("filtersNoModels")} />
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
                {t("filtersShowLess")} <ChevronUp className="ml-1 h-3 w-3" />
              </>
            ) : (
              <>
                {t("filtersShowMore")} ({visibleModelFilterItems.length - MODELS_COUNT}){" "}
                <ChevronDown className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
