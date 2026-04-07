"use client";

import { CheckCircle2, Sparkles, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/shared/hooks/use-i18n";
import {
  PerceptionDonutVisual,
  PerceptionLeftPanel,
  PerceptionModelAxisHeatmap,
  PerceptionScoreMiniCard,
  PerceptionThreeColumnLayout,
  PerceptionTrendChart,
  TopErrorsPanel,
} from "../_components";
import {
  getPerceptionPeriodBadgeLabel,
  getPerceptionPeriodLabel,
  usePerceptionViewModel,
} from "../_lib";
import type { PerceptionViewData } from "@/lib/perception-data";

type PerceptionClientProps = {
  initialData: PerceptionViewData;
};

const SCORE_CARD_ICONS = {
  positioning: Target,
  factual: CheckCircle2,
  sentiment: Sparkles,
} as const;

export function PerceptionClient({ initialData }: PerceptionClientProps) {
  const { locale } = useLocale();
  const viewModel = usePerceptionViewModel(initialData);
  const periodLabel = getPerceptionPeriodLabel(viewModel.selectedPeriod, locale);
  const periodBadgeLabel = getPerceptionPeriodBadgeLabel(viewModel.selectedPeriod, locale);

  return (
    <PerceptionThreeColumnLayout
      left={
        <PerceptionLeftPanel
          canon={initialData.brandCanon}
          radar={viewModel.filteredRadar}
          trendData={viewModel.perceptionTrend.data}
          windowLabel={periodLabel}
          analyzedResponses={viewModel.filteredResponses.length}
          selectedModels={viewModel.selectedModels}
          modelOptions={viewModel.modelCatalog}
          selectedPeriod={viewModel.selectedPeriod}
          onModelToggle={(model) =>
            viewModel.setSelectedModels((current) =>
              current.includes(model)
                ? current.filter((item) => item !== model)
                : [...current, model],
            )
          }
          onResetModels={() => viewModel.setSelectedModels([])}
          onPeriodChange={viewModel.setSelectedPeriod}
          showAllModels={viewModel.showAllModels}
          onToggleShowAllModels={() =>
            viewModel.setShowAllModels((current) => !current)
          }
          showUniqueModelFilters={viewModel.showUniqueModelFilters}
          onToggleModelFilterMode={(value) => {
            viewModel.setShowUniqueModelFilters(value);
            viewModel.setShowAllModels(false);
          }}
          isDemo={!initialData.metadata.projectId}
        />
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Card className="border-border/60 overflow-hidden py-4">
            <CardContent className="p-0">
              <PerceptionDonutVisual
                points={viewModel.filteredRadar}
                periodLabel={periodBadgeLabel}
              />
            </CardContent>
          </Card>

          <PerceptionModelAxisHeatmap
            axes={viewModel.modelAxisHeatmap.axes}
            rows={viewModel.modelAxisHeatmap.rows}
            periodLabel={periodBadgeLabel}
          />
          <PerceptionTrendChart
            data={viewModel.perceptionTrend.data}
            periodLabel={periodLabel}
            badgeLabel={periodBadgeLabel}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {viewModel.scoreCards.map((card) => (
              <PerceptionScoreMiniCard
                key={card.id}
                {...card}
                icon={SCORE_CARD_ICONS[card.id as keyof typeof SCORE_CARD_ICONS]}
              />
            ))}
          </div>
        </div>
      }
      right={
        <div className="px-1 pb-4">
          <TopErrorsPanel errors={viewModel.filteredTopErrors} />
        </div>
      }
    />
  );
}
