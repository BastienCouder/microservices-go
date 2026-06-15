"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useLocale, useScopedI18n } from "@/shared/hooks/use-i18n";
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
import type { PerceptionViewData } from "../_lib/shared/perception-data";
import { CheckCircle2, Download, Sparkles, Target } from "lucide-react";
import { useSelectedOrganizationPermissions } from "@/shared/organization-permissions";

type PerceptionClientProps = {
  apiBaseURL: string;
  initialData: PerceptionViewData;
  routeSearch: string;
};

const SCORE_CARD_ICONS = {
  positioning: Target,
  factual: CheckCircle2,
  sentiment: Sparkles,
} as const;

export function PerceptionClient({ apiBaseURL, initialData, routeSearch }: PerceptionClientProps) {
  const { locale } = useLocale();
  const { t } = useScopedI18n("perception");
  const viewModel = usePerceptionViewModel(initialData, { apiBaseURL, routeSearch });
  const permissions = useSelectedOrganizationPermissions({ apiBaseURL, routeSearch });
  const emptyStateLabel = initialData.metadata.emptyStateLabel;
  const periodLabel = getPerceptionPeriodLabel(
    viewModel.selectedPeriod,
    locale,
  );
  const periodBadgeLabel = getPerceptionPeriodBadgeLabel(
    viewModel.selectedPeriod,
    locale,
  );
  const heroActions = (
    <div className="flex flex-col md:flex-row items-center gap-2">
      {permissions.canEdit ? (
        <ConfirmDialog
          title={t("confirmAnalysisTitle")}
          description={
            viewModel.perceptionMonthlyCredits > 0
              ? t("confirmAnalysisDescriptionWithQuota", {
                  credits: viewModel.estimatedPerceptionCredits,
                  remaining: viewModel.perceptionRemainingCredits,
                  total: viewModel.perceptionMonthlyCredits,
                })
              : t("confirmAnalysisDescriptionWithoutQuota", {
                  credits: viewModel.estimatedPerceptionCredits,
                })
          }
          confirmLabel={
            viewModel.analysisRunning ? t("analysisRunning") : t("launchAnalysis")
          }
          cancelLabel={t("cancel")}
          confirmVariant="default"
          loading={viewModel.analysisRunning}
          onConfirm={viewModel.handleRunPerceptionAnalysis}
          confirmDisabled={viewModel.perceptionQuotaLoading}
          trigger={
            <Button
              size="sm"
              variant="secondary"
              className="bg-background/20 text-background/90 hover:bg-background/30 hover:text-background"
              disabled={
                viewModel.analysisRunning ||
                viewModel.perceptionQuotaLoading ||
                !initialData.metadata.projectId
              }
            >
              {t("analyzePerception")}
            </Button>
          }
        />
      ) : null}
      {viewModel.canExport ? (
        <Button
          size="sm"
          variant="secondary"
          className="bg-background/20 text-background/90 hover:bg-background/30 hover:text-background"
          disabled={viewModel.exportDisabled}
          onClick={() => viewModel.handleExportPerceptionData(periodLabel)}
        >
          <Download className="size-4" />
          {t("exportExcel")}
        </Button>
      ) : null}
    </div>
  );

  const rightColumn = (
    <div className="space-y-3 px-1 pb-4">
      {viewModel.lastAnalysisCredits !== null ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          {t("analysisStartedWithCredits", {
            credits: viewModel.lastAnalysisCredits,
          })}
        </p>
      ) : null}
      {viewModel.analysisError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {viewModel.analysisError}
        </p>
      ) : null}
      <TopErrorsPanel
        emptyLabel={emptyStateLabel}
        errors={viewModel.filteredTopErrors}
        generatedIds={viewModel.generatedIds}
        modelCatalog={viewModel.modelCatalog}
        projectId={initialData.metadata.projectId}
        savingErrorIds={viewModel.savingErrorIds}
        totalErrorCount={viewModel.filteredTopErrorsTotalCount}
        onCreateAction={permissions.canEdit ? viewModel.handleFix : undefined}
        onRemoveAction={permissions.canEdit ? viewModel.handleRemoveAction : undefined}
      />
    </div>
  );

  return (
    <PerceptionThreeColumnLayout
      left={
        <div className="flex h-auto flex-col gap-4 xl:h-full xl:min-h-0">
          <div className="min-h-0 flex-1 overflow-hidden">
            <PerceptionLeftPanel
              canon={initialData.brandCanon}
              radar={viewModel.filteredRadar}
              trendData={viewModel.perceptionTrend.data}
              windowLabel={periodLabel}
              analyzedResponses={viewModel.filteredResponses.length}
              selectedSourceFilter={viewModel.selectedSourceFilter}
              selectedModels={viewModel.selectedModels}
              modelOptions={viewModel.modelCatalog}
              selectedPeriod={viewModel.selectedPeriod}
              onSourceFilterChange={viewModel.setSelectedSourceFilter}
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
              heroActions={heroActions}
            />
          </div>
        </div>
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Card className="shrink-0 overflow-hidden border-border/60 py-4">
            <CardContent className="p-0">
              <PerceptionDonutVisual
                points={viewModel.filteredRadar}
                periodLabel={periodBadgeLabel}
                emptyLabel={emptyStateLabel}
              />
            </CardContent>
          </Card>

          <PerceptionModelAxisHeatmap
            axes={viewModel.modelAxisHeatmap.axes}
            rows={viewModel.modelAxisHeatmap.rows}
            periodLabel={periodBadgeLabel}
            emptyLabel={emptyStateLabel}
          />

          <PerceptionTrendChart
            data={viewModel.perceptionTrend.data}
            periodLabel={periodLabel}
            badgeLabel={periodBadgeLabel}
            emptyLabel={emptyStateLabel}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {viewModel.scoreCards.map((card) => (
              <PerceptionScoreMiniCard
                key={card.id}
                {...card}
                icon={
                  SCORE_CARD_ICONS[card.id as keyof typeof SCORE_CARD_ICONS]
                }
              />
            ))}
          </div>
        </div>
      }
      right={rightColumn}
    />
  );
}
