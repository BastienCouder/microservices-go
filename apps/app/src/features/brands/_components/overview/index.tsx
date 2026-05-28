import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/shared/section-title";
import { usePerceptionData } from "@/features/perception/core/use-perception-data";
import { PageHeader } from "@/components/shared/page-header";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import { createEmptyPerceptionViewData } from "@/lib/perception-data";
import {
  deriveShortDescription,
} from "../../_lib/overview/brand-overview-helpers";
import { buildBrandCanonLocation } from "../../brand-canon/_lib/brand-canon-utils";

type BrandsOverviewPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandsOverviewPanel({ apiBaseURL, routeSearch }: BrandsOverviewPanelProps) {
  const { data, error, loading } = usePerceptionData(apiBaseURL, routeSearch);

  if (loading && !data) {
    return <BrandPageLoadingState />;
  }

  const viewData = data ?? createEmptyPerceptionViewData(routeSearch);
  const emptyLabel = error || PERCEPTION_TEXT.brandCanon.empty;
  const shortDescription = deriveShortDescription(viewData.brandCanon);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-2 pb-4 pt-2 sm:px-4 sm:pb-5 md:p-4">
      <PageHeader
        title="Profil de marque"
        baseline="Toutes les informations essentielles de la marque sont réunies sur un seul écran pour être relues rapidement."
        actionsVariant="classic"
        className="gap-3 md:gap-4"
        actions={
          <Button asChild variant="default" className="w-auto max-w-full whitespace-nowrap">
            <Link to={buildBrandCanonLocation(routeSearch)}>
              Modifier le profil de marque
            </Link>
          </Button>
        }
      />

      <div className="space-y-3 sm:space-y-4">
        <Card className="border-border/60 rounded-tr-none">
          <CardHeader>
            <CardTitle className="text-base">
              <SectionTitle showIndicator={false}>Résumé rapide</SectionTitle>
            </CardTitle>
            <CardDescription>
              Les informations les plus utiles pour comprendre la marque immédiatement.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BrandField label="Nom de la marque" value={viewData.brandCanon.brandName} emptyLabel={emptyLabel} />
            <BrandField label="Secteur" value={viewData.brandCanon.category} emptyLabel={emptyLabel} />
            <BrandField label="Résumé court" value={shortDescription} emptyLabel={emptyLabel} />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">
              <SectionTitle showIndicator={false}>Description de référence</SectionTitle>
            </CardTitle>
            <CardDescription>
              La formulation qui décrit précisément la marque et son positionnement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandField
              label="Description"
              value={viewData.brandCanon.positioning}
              emptyLabel={emptyLabel}
              multiline
            />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
       
          <BrandListSection
            label="Cas d’usage prioritaires"
            items={viewData.brandCanon.useCases}
            emptyLabel={emptyLabel}
            variant="numbered"
          />
          <BrandListSection
            label="Fonctionnalités clés"
            items={viewData.brandCanon.features}
            emptyLabel={emptyLabel}
            variant="stack"
          />
          <BrandCompetitorsSection
            competitors={viewData.competitors}
            emptyLabel={emptyLabel}
          />
        </div>
      </div>
    </div>
  );
}

function BrandField({
  emptyLabel = PERCEPTION_TEXT.brandCanon.empty,
  label,
  value,
  multiline = false,
}: {
  emptyLabel?: string;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const safeValue = value.trim();

  return (
    <div className="h-full rounded-xl border border-border/60 bg-background/80 p-4">
      <div className="text-sm font-bold text-primary">{label}</div>
      {safeValue ? (
        <div className={multiline ? "mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed" : "mt-2 break-words text-sm font-medium"}>
          {safeValue}
        </div>
      ) : (
        <EmptyStateCard label={emptyLabel} className="mt-3 h-14" />
      )}
    </div>
  );
}

function BrandListSection({
  label,
  items,
  emptyLabel,
  variant,
  action,
}: {
  label: string;
  items: string[];
  emptyLabel: string;
  variant: "badge" | "stack" | "numbered";
  action?: ReactNode;
}) {
  const content = items.length === 0 ? (
    <EmptyStateCard label={emptyLabel} />
  ) : variant === "badge" ? (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="secondary" className="font-normal">
          {item}
        </Badge>
      ))}
    </div>
  ) : variant === "numbered" ? (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item}
          className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/15 px-3 py-2 text-sm"
        >
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium">
            {index + 1}
          </span>
          <span className="break-words">{item}</span>
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 rounded-lg bg-muted/15 px-3 py-2 text-sm">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="break-words">{item}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base">
            <SectionTitle showIndicator={false}>{label}</SectionTitle>
          </CardTitle>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          content
        ) : (
          <div className="max-h-[50vh] overflow-y-auto pr-1 sm:h-[220px] sm:max-h-none sm:pr-3">
            {content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BrandCompetitorsSection({
  competitors,
  emptyLabel,
  action,
}: {
  competitors: Array<{ name: string; website: string }>;
  emptyLabel: string;
  action?: ReactNode;
}) {
  const content = competitors.length === 0 ? (
    <EmptyStateCard label={emptyLabel} />
  ) : (
    <div className="space-y-2">
      {competitors.map((competitor) => (
        <div
          key={`${competitor.name}-${competitor.website}`}
          className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2"
        >
          <div className="break-words text-sm font-medium text-foreground">{competitor.name}</div>
          {competitor.website ? (
            <div className="mt-1 break-all text-xs text-muted-foreground">{competitor.website}</div>
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base">
            <SectionTitle showIndicator={false}>Concurrents</SectionTitle>
          </CardTitle>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>
        {competitors.length === 0 ? (
          content
        ) : (
          <div className="max-h-[50vh] overflow-y-auto pr-1 sm:h-[280px] sm:max-h-none sm:pr-3">
            {content}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BrandPageLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-2 pb-4 pt-2 sm:px-4 sm:pb-5 md:p-4">
      <div className="space-y-3 px-2 sm:px-0">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </div>

      <div className="mt-4 space-y-3 sm:space-y-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle><Skeleton className="h-4 w-32" /></CardTitle>
            <CardDescription><Skeleton className="h-3 w-64 max-w-full" /></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle><Skeleton className="h-4 w-40" /></CardTitle>
            <CardDescription><Skeleton className="h-3 w-60 max-w-full" /></CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-40 w-full rounded-xl" />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
