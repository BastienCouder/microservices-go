import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import type { BrandCanon } from "../_lib/shared/perception-data";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { PerceptionLeftPanel } from "./perception-left-panel";
import { PerceptionThreeColumnLayout } from "./perception-three-column-layout";
import { t } from "i18next";

const EMPTY_BRAND_CANON: BrandCanon = {
  brandName: "",
  category: "",
  positioning: "",
  audience: [],
  useCases: [],
  pricing: {
    amount: 0,
    currency: "",
    period: "",
    note: "",
  },
  features: [],
};

export function PerceptionUnavailableState({
  error,
}: {
  error: string | null;
}) {
  const { t } = useScopedI18n("perception");
  const errorLabel = error?.trim() || t("unavailableNoData");

  return (
    <PerceptionThreeColumnLayout
      left={
        <PerceptionLeftPanel
          canon={EMPTY_BRAND_CANON}
          radar={[]}
          trendData={[]}
          windowLabel="--"
          analyzedResponses={0}
          selectedSourceFilter="perception"
          selectedModels={[]}
          modelOptions={[]}
          selectedPeriod="30d"
          onSourceFilterChange={() => undefined}
          onModelToggle={() => undefined}
          onResetModels={() => undefined}
          onPeriodChange={() => undefined}
          showAllModels={false}
          onToggleShowAllModels={() => undefined}
          showUniqueModelFilters={false}
          onToggleModelFilterMode={() => undefined}
          isDemo={false}
        />
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Card className="border-border/60 overflow-hidden py-4">
            <CardContent className="space-y-3 px-4">
              <div>
                <SectionTitle>{t("donutTitle")}</SectionTitle>
              </div>
              <div className="text-sm text-muted-foreground">{t("donutSubtitle")}</div>
              <EmptyStateCard label={errorLabel} className="h-[320px] text-sm" />
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <SectionTitle>{t("heatmapTitle")}</SectionTitle>
              </CardTitle>
              <CardDescription>{t("heatmapDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <EmptyStateCard label={errorLabel} className="h-[280px] text-sm" />
            </CardContent>
          </Card>
        </div>
      }

    />
  );
}

{ /* right={
        <div className="px-1 pb-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                <SectionTitle>{t("topErrorsTitle")}</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmptyStateCard label={errorLabel} className="h-[440px] text-sm" />
            </CardContent>
          </Card>
        </div>
      } */}

export function BrandCanonUnavailableState({
  error,
  onReload,
}: {
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const { t } = useScopedI18n("perception");
  const errorLabel = error?.trim() || t("unavailableNoData");

  return (
    <div className="mx-0 my-0 grid grid-cols-12 gap-0 md:m-4 xl:h-full xl:min-h-0">
      <div className="col-span-12 xl:col-span-8 xl:col-start-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("brandCanonUnavailableTitle")}</CardTitle>
            <CardDescription>
              {t("brandCanonUnavailableDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <EmptyStateCard label={errorLabel} className="h-24 text-sm" />
            <Button onClick={() => void onReload()}>{t("reload")}</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
