"use client";

import type { ReactNode } from "react";
import { Edit3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSectionTitle } from "@/features/monitoring/_components/dashboard-section-title";
import { usePerceptionData } from "@/features/perception/core/use-perception-data";
import { PageHeader } from "@/features/shared/view/page-header";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import type { BrandCanon } from "@/lib/perception-data";

type BrandsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandsTemplate({ apiBaseURL, routeSearch }: BrandsTemplateProps) {
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
            <Link to={{ pathname: "/perception/brand-canon", search: buildBrandCanonSearch(routeSearch, "brand") }}>
              <Edit3 className="mr-2 h-4 w-4" />
              Modifier le référentiel
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <Card className="border-border/60 rounded-tr-none">
          <CardHeader>
            <CardTitle className="text-base">
              <DashboardSectionTitle>Résumé rapide</DashboardSectionTitle>
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
              <DashboardSectionTitle>Description de référence</DashboardSectionTitle>
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

        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-4">
          <BrandListSection
            label="Personas cibles"
            items={data.brandCanon.audience}
            emptyLabel={PERCEPTION_TEXT.brandCanon.empty}
            variant="badge"
            action={
              <Button asChild variant="outline" size="sm">
                <Link
                  to={{
                    pathname: "/perception/brand-canon",
                    search: buildBrandCanonSearch(routeSearch, "personas"),
                  }}
                >
                  Modifier persona
                </Link>
              </Button>
            }
          />
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
            emptyLabel={PERCEPTION_TEXT.brandCanon.empty}
            action={
              <Button asChild variant="outline" size="sm">
                <Link
                  to={{
                    pathname: "/perception/brand-canon",
                    search: buildBrandCanonSearch(routeSearch, "competitors"),
                  }}
                >
                  Modifier concurrent
                </Link>
              </Button>
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
  const safeValue = value.trim() || PERCEPTION_TEXT.brandCanon.empty;

  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-4">
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className={multiline ? "mt-2 text-sm leading-relaxed whitespace-pre-wrap" : "mt-2 text-sm font-medium"}>
        {safeValue}
      </div>
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
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">
            <DashboardSectionTitle>{label}</DashboardSectionTitle>
          </CardTitle>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">{emptyLabel}</div>
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
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">
            <DashboardSectionTitle>Concurrents</DashboardSectionTitle>
          </CardTitle>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent>
        {competitors.length === 0 ? (
          <div className="text-sm text-muted-foreground">{emptyLabel}</div>
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
              <Link to={{ pathname: "/perception/brand-canon", search: buildBrandCanonSearch(routeSearch, "brand") }}>
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

function deriveShortDescription(canon: BrandCanon): string {
  const positioning = canon.positioning.trim();
  if (!positioning) return canon.category.trim();

  const sentence = positioning.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  if (sentence.length > 0 && sentence.length <= 180) {
    return sentence;
  }

  return `${positioning.slice(0, 177).trimEnd()}...`;
}

function buildBrandCanonSearch(routeSearch: string, tab: "brand" | "personas" | "competitors"): string {
  const params = new URLSearchParams(routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch);
  params.set("tab", tab);
  const query = params.toString();
  return query ? `?${query}` : "";
}
