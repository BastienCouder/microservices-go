import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FiltersEmptyStateCard } from "@/features/monitoring/_components/shared/filters-empty-state-card";
import { MonitoringSectionTitle } from "@/features/monitoring/_components/shared/monitoring-section-title";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import type { BrandCanon } from "@/lib/perception-data";
import { PerceptionLeftPanel } from "./perception-left-panel";
import { PerceptionThreeColumnLayout } from "./perception-three-column-layout";

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
  const errorLabel = (error || "").trim().toLowerCase() !== "" ? "Aucune donnée" : "Aucune donnée";

  return (
    <PerceptionThreeColumnLayout
      left={
        <PerceptionLeftPanel
          canon={EMPTY_BRAND_CANON}
          source="project"
          windowLabel="--"
          analyzedResponses={0}
          selectedModels={[]}
          modelOptions={[]}
          selectedPeriod="30d"
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
                <MonitoringSectionTitle>{PERCEPTION_TEXT.donut.title}</MonitoringSectionTitle>
              </div>
              <div className="text-sm text-muted-foreground">{PERCEPTION_TEXT.donut.subtitle}</div>
              <FiltersEmptyStateCard label={errorLabel} className="h-[320px] text-sm" />
            </CardContent>
          </Card>
          <Card className="min-w-0 border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <MonitoringSectionTitle>{PERCEPTION_TEXT.heatmap.title}</MonitoringSectionTitle>
              </CardTitle>
              <CardDescription>{PERCEPTION_TEXT.heatmap.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <FiltersEmptyStateCard label="Aucune donnée" className="h-[280px] text-sm" />
            </CardContent>
          </Card>
        </div>
      }
      right={
        <div className="px-1 pb-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                <MonitoringSectionTitle>{PERCEPTION_TEXT.topErrors.title}</MonitoringSectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FiltersEmptyStateCard label={errorLabel} className="h-[440px] text-sm" />
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}

export function BrandCanonUnavailableState({
  error,
  onReload,
}: {
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const errorLabel = (error || "").trim().toLowerCase() !== "" ? "Aucune donnée" : "Aucune donnée";

  return (
    <div className="mx-0 my-0 grid grid-cols-12 gap-0 md:m-4 xl:h-full xl:min-h-0">
      <div className="col-span-12 xl:col-span-8 xl:col-start-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Éditeur du référentiel de marque</CardTitle>
            <CardDescription>
              Modifiez la source de vérité de la marque : catégorie, cas d’usage, fonctionnalités et concurrents.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0">
            <FiltersEmptyStateCard label={errorLabel} className="h-24 text-sm" />
            <Button onClick={() => void onReload()}>Recharger</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
