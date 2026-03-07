import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FiltersEmptyStateCard } from "@/features/dashboard/_components/filters-empty-state-card";
import { DashboardSectionTitle } from "@/features/dashboard/_components/dashboard-section-title";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import type { BrandCanon } from "@/lib/perception-data";
import { BrandCanonEditorPageClient } from "../brand-canon/page-client";
import { usePerceptionData } from "../core/use-perception-data";
import { PerceptionThreeColumnLayout } from "../_components/perception-three-column-layout";
import { PerceptionLeftPanel } from "../_components/perception-left-panel";
import { PerceptionClient } from "../perception-client";

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
    return <BrandCanonEditorPageClient initialData={data} />;
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
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-28 w-full" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <PerceptionThreeColumnLayout
      left={
        <Card className="h-full">
          <CardContent className="space-y-4 p-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      }
      center={
        <div className="space-y-4 px-1 pb-4">
          <Skeleton className="h-64 w-full rounded-md" />
          <Skeleton className="h-72 w-full rounded-md" />
          <Skeleton className="h-72 w-full rounded-md" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
          <Skeleton className="h-64 w-full rounded-md" />
        </div>
      }
      right={
        <div className="px-1 pb-4">
          <Skeleton className="h-[520px] w-full rounded-md" />
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
              <CardTitle>Brand Canon Editor</CardTitle>
              <CardDescription>
                Editez la source de vérité de la marque (catégorie, audience, use cases, pricing, features).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6 pt-0">
              <FiltersEmptyStateCard label={errorLabel} className="h-24 text-sm" />
              <FiltersEmptyStateCard label="Aucune donnée" className="h-10 text-sm" />
              <FiltersEmptyStateCard label="Aucune donnée" className="h-10 text-sm" />
              <FiltersEmptyStateCard label="Aucune donnée" className="h-28 text-sm" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FiltersEmptyStateCard label="Aucune donnée" className="h-10 text-sm" />
                <FiltersEmptyStateCard label="Aucune donnée" className="h-10 text-sm" />
                <FiltersEmptyStateCard label="Aucune donnée" className="h-10 text-sm" />
              </div>
              <FiltersEmptyStateCard label="Aucune donnée" className="h-10 text-sm" />
              <FiltersEmptyStateCard label="Aucune donnée" className="h-24 text-sm" />
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
