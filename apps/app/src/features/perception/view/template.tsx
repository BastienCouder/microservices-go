import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FiltersEmptyStateCard } from "@/features/monitoring/components/filters-empty-state-card";
import { DashboardSectionTitle } from "@/features/monitoring/components/dashboard-section-title";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import type { BrandCanon } from "@/lib/perception-data";
import { BrandCanonEditorPageClient } from "../brand-canon/view/client";
import { usePerceptionData } from "../core/use-perception-data";
import { PerceptionThreeColumnLayout } from "../components/perception-three-column-layout";
import { PerceptionLeftPanel } from "../components/perception-left-panel";
import { PerceptionClient } from "./client";

type PerceptionTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
  brandCanonMode?: boolean;
};

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

export function PerceptionTemplate({
  apiBaseURL,
  routeSearch,
  brandCanonMode = false,
}: PerceptionTemplateProps) {
  const { data, error, loading, reload } = usePerceptionData(apiBaseURL, routeSearch);

  if (loading && !data) {
    return <PerceptionLoadingState brandCanonMode={brandCanonMode} />;
  }

  if (!data) {
    return <PerceptionUnavailableState brandCanonMode={brandCanonMode} error={error} onReload={reload} />;
  }

  if (brandCanonMode) {
    return <BrandCanonEditorPageClient initialData={data} apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
  }

  return <PerceptionClient initialData={data} />;
}

function PerceptionLoadingState({ brandCanonMode }: { brandCanonMode: boolean }) {
  if (brandCanonMode) {
    return (
      <div className="mx-0 my-0 grid grid-cols-12 gap-0 md:m-4 xl:h-full xl:min-h-0">
        <div className="col-span-12 xl:col-span-8 xl:col-start-3">
          <Card>
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-8 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20 rounded-xl" />
                <Skeleton className="h-9 w-24 rounded-xl" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-28 w-full rounded-xl" />
                <Skeleton className="h-28 w-full rounded-xl" />
              </div>
              <Skeleton className="h-44 w-full rounded-xl" />
              <div className="grid gap-4 xl:grid-cols-2">
                <Skeleton className="h-56 w-full rounded-xl" />
                <Skeleton className="h-56 w-full rounded-xl" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-9 w-28 rounded-xl" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <PerceptionThreeColumnLayout
      left={
        <div className="space-y-4 p-2">
          <Card className="border-border/60">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-3 rounded-md bg-primary/8 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
              </div>

              <div className="space-y-3">
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-8 w-24" />
                <div className="space-y-2">
                  <Skeleton className="h-[92px] w-full rounded-md" />
                  <Skeleton className="h-[92px] w-full rounded-md" />
                  <Skeleton className="h-[92px] w-full rounded-md" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Card className="border-border/60 overflow-hidden py-4">
            <CardContent className="space-y-4 px-5 py-0">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <Skeleton className="h-14 w-20 rounded-md" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-[84px] w-full rounded-[20px]" />
                <Skeleton className="h-[84px] w-full rounded-[20px]" />
                <Skeleton className="h-[84px] w-full rounded-[20px]" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-border/60">
            <CardHeader className="pb-2">
              <CardTitle><Skeleton className="h-4 w-44" /></CardTitle>
              <CardDescription><Skeleton className="h-3 w-72 max-w-full" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle><Skeleton className="h-4 w-40" /></CardTitle>
              <CardDescription><Skeleton className="h-3 w-80 max-w-full" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[230px] w-full rounded-md" />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <Skeleton className="h-[74px] w-full rounded-md" />
                <Skeleton className="h-[74px] w-full rounded-md" />
                <Skeleton className="h-[74px] w-full rounded-md" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="border-border/60">
              <CardContent className="flex min-h-[170px] flex-col items-center gap-3 p-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex min-h-[170px] flex-col items-center gap-3 p-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="flex min-h-[170px] flex-col items-center gap-3 p-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle><Skeleton className="h-4 w-44" /></CardTitle>
              <CardDescription><Skeleton className="h-3 w-72 max-w-full" /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[88px] w-full rounded-md" />
              <Skeleton className="h-[88px] w-full rounded-md" />
              <Skeleton className="h-[88px] w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      }
      right={
        <div className="px-1 pb-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle><Skeleton className="h-4 w-36" /></CardTitle>
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-[116px] w-full rounded-md" />
              <Skeleton className="h-[116px] w-full rounded-md" />
              <Skeleton className="h-[116px] w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}

function PerceptionUnavailableState({
  brandCanonMode,
  error,
  onReload,
}: {
  brandCanonMode: boolean;
  error: string | null;
  onReload: () => Promise<void>;
}) {
  const normalized = (error || "").trim().toLowerCase();
  const errorLabel = normalized !== "" ? "Aucune donnée" : "Aucune donnée";

  if (brandCanonMode) {
    return (
      <div className="mx-0 my-0 grid grid-cols-12 gap-0 md:m-4 xl:h-full xl:min-h-0">
        <div className="col-span-12 xl:col-span-8 xl:col-start-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Éditeur du référentiel de marque</CardTitle>
              <CardDescription>
                Modifiez la source de vérité de la marque : catégorie, audience, cas d'usage, fonctionnalités et concurrents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6 pt-0">
              <FiltersEmptyStateCard label={errorLabel} className="h-24 text-sm" />
              <div className="flex gap-3">
                <FiltersEmptyStateCard label="Aucune donnée" className="h-10 w-24 text-sm" />
                <FiltersEmptyStateCard label="Aucune donnée" className="h-10 w-28 text-sm" />
                <FiltersEmptyStateCard label="Aucune donnée" className="h-10 w-32 text-sm" />
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <FiltersEmptyStateCard label="Aucune donnée" className="h-28 text-sm" />
                <FiltersEmptyStateCard label="Aucune donnée" className="h-28 text-sm" />
              </div>
              <FiltersEmptyStateCard label="Aucune donnée" className="h-40 text-sm" />
              <div className="grid gap-3 xl:grid-cols-2">
                <FiltersEmptyStateCard label="Aucune donnée" className="h-32 text-sm" />
                <FiltersEmptyStateCard label="Aucune donnée" className="h-32 text-sm" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
                <DashboardSectionTitle>{PERCEPTION_TEXT.donut.title}</DashboardSectionTitle>
              </div>
              <div className="text-sm text-muted-foreground">{PERCEPTION_TEXT.donut.subtitle}</div>
              <FiltersEmptyStateCard label={errorLabel} className="h-[320px] text-sm" />
            </CardContent>
          </Card>

          <Card className="min-w-0 border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <DashboardSectionTitle>{PERCEPTION_TEXT.heatmap.title}</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>{PERCEPTION_TEXT.heatmap.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <FiltersEmptyStateCard label="Aucune donnée" className="h-[280px] text-sm" />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <DashboardSectionTitle>{PERCEPTION_TEXT.trend.title}</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>
                {PERCEPTION_TEXT.trend.descriptionPrefix} -- {PERCEPTION_TEXT.trend.descriptionSuffix}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FiltersEmptyStateCard label="Aucune donnée" className="h-[230px] text-sm" />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className="group overflow-hidden border-border/60">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="text-center text-sm font-semibold leading-tight">{PERCEPTION_TEXT.scoreCards.positioning.title}</div>
                  <FiltersEmptyStateCard label="Aucune donnée" className="h-24 text-sm" />
                </div>
              </CardContent>
            </Card>
            <Card className="group overflow-hidden border-border/60">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="text-center text-sm font-semibold leading-tight">{PERCEPTION_TEXT.scoreCards.factual.title}</div>
                  <FiltersEmptyStateCard label="Aucune donnée" className="h-24 text-sm" />
                </div>
              </CardContent>
            </Card>
            <Card className="group overflow-hidden border-border/60">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="text-center text-sm font-semibold leading-tight">{PERCEPTION_TEXT.scoreCards.sentiment.title}</div>
                  <FiltersEmptyStateCard label="Aucune donnée" className="h-24 text-sm" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                <DashboardSectionTitle>{PERCEPTION_TEXT.optimizeActions.title}</DashboardSectionTitle>
              </CardTitle>
              <CardDescription>{PERCEPTION_TEXT.optimizeActions.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <FiltersEmptyStateCard label="Aucune donnée" className="h-40 text-sm" />
            </CardContent>
          </Card>
        </div>
      }
      right={
        <div className="px-1 pb-4">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold">
                    <DashboardSectionTitle>{PERCEPTION_TEXT.topErrors.title}</DashboardSectionTitle>
                  </CardTitle>
                </div>
              </div>
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
