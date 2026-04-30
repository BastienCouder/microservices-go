import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionTitle } from "@/components/shared/section-title";
import { usePerceptionData } from "@/features/perception/core/use-perception-data";
import { PageHeader } from "@/components/shared/page-header";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import {
  deriveShortDescription,
} from "../../_lib/overview/brand-overview-helpers";
import { buildBrandCanonLocation } from "../../brand-canon/_lib/brand-canon-utils";

type BrandsOverviewPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandsOverviewPanel({ apiBaseURL, routeSearch }: BrandsOverviewPanelProps) {
  const { data, error, loading, reload } = usePerceptionData(apiBaseURL, routeSearch);

  if (loading && !data) {
    return <BrandPageLoadingState />;
  }

  if (!data) {
    return <BrandPageUnavailableState error={error} routeSearch={routeSearch} onReload={reload} />;
  }

  const shortDescription = deriveShortDescription(data.brandCanon);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Marque"
        baseline="Toutes les informations essentielles de la marque réunies sur un seul écran pour être relues rapidement."
        actionsVariant="classic"
        actions={
          <Button asChild variant="default">
            <Link to={buildBrandCanonLocation(routeSearch)}>
              Modifier le référentiel
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <Card className="border-border/60 rounded-tr-none">
          <CardHeader>
            <CardTitle className="text-base">
              <SectionTitle showIndicator={false}>Résumé rapide</SectionTitle>
            </CardTitle>
            <CardDescription>
              Les informations les plus utiles pour comprendre la marque immédiatement.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <BrandField label="Nom de la marque" value={data.brandCanon.brandName} />
            <BrandField label="Secteur" value={data.brandCanon.category} />
            <BrandField label="Résumé court" value={shortDescription} />
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
              value={data.brandCanon.positioning}
              multiline
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
       
          <BrandListSection
            label="Cas d’usage prioritaires"
            items={data.brandCanon.useCases}
            emptyLabel={PERCEPTION_TEXT.brandCanon.empty}
            variant="numbered"
          />
          <BrandListSection
            label="Fonctionnalités clés"
            items={data.brandCanon.features}
            emptyLabel={PERCEPTION_TEXT.brandCanon.empty}
            variant="stack"
          />
          <BrandCompetitorsSection
            competitors={data.competitors}
            emptyLabel={PERCEPTION_TEXT.brandCanon.empty
            }
          />
        </div>
      </div>
    </div>
  );
}

function BrandField({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const safeValue = value.trim();

  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      {safeValue ? (
        <div className={multiline ? "mt-2 text-sm leading-relaxed whitespace-pre-wrap" : "mt-2 text-sm font-medium"}>
          {safeValue}
        </div>
      ) : (
        <EmptyStateCard label={PERCEPTION_TEXT.brandCanon.empty} className="mt-3 h-14" />
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
          <span>{item}</span>
        </div>
      ))}
    </div>
  ) : (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 rounded-lg bg-muted/15 px-3 py-2 text-sm">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
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
          <ScrollArea className="h-[220px] pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
            {content}
          </ScrollArea>
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
          <div className="text-sm font-medium text-foreground">{competitor.name}</div>
          {competitor.website ? (
            <div className="mt-1 text-xs text-muted-foreground">{competitor.website}</div>
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
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
          <ScrollArea className="h-[280px] pr-3 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
            {content}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function BrandPageLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <div className="space-y-3 px-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-[36rem] max-w-full" />
      </div>

      <div className="mt-4 space-y-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle><Skeleton className="h-4 w-32" /></CardTitle>
            <CardDescription><Skeleton className="h-3 w-64 max-w-full" /></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-24 w-full rounded-xl" />
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

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function BrandPageUnavailableState({
  error,
  routeSearch,
  onReload,
}: {
  error: string | null;
  routeSearch: string;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Marque"
        baseline="Toutes les informations essentielles de la marque réunies sur un seul écran."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void onReload()}>
              Réessayer
            </Button>
            <Button asChild>
              <Link to={buildBrandCanonLocation(routeSearch)}>
                Modifier le référentiel
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mt-4 border-border/60">
        <CardHeader>
          <CardTitle>Impossible de charger la marque</CardTitle>
          <CardDescription>
            {error || "Aucune donnée de référentiel ou de perception n’est disponible pour ce projet."}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
