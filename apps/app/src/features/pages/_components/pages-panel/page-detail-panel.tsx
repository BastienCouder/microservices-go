import { ExternalLink, Link2 } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import type { PageInsight } from "../../_lib/pages-panel/types";
import { ModelBadgeItem } from "./model-badge";

type PageDetailPanelProps = {
  page: PageInsight | null;
  loading?: boolean;
};

export function PageDetailPanel({ page, loading = false }: PageDetailPanelProps) {
  if (loading) {
    return <PageDetailSkeleton />;
  }

  if (!page) {
    return (
      <Card className="flex min-h-0 overflow-hidden rounded-md border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">
              <SectionTitle>Détail de la page</SectionTitle>
            </CardTitle>
            <CardDescription className="flex min-w-0 items-center gap-2">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>Aucune URL sélectionnée</span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <EmptyStateCard
            label="Aucune page citée pour le moment."
            className="h-[300px]"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 overflow-hidden rounded-md border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                <SectionTitle>Détail de la page</SectionTitle>
              </CardTitle>
              <CardDescription className="flex min-w-0 items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{page.url}</span>
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="h-7 rounded-md px-2.5">
                {page.citationShare}% visibilité
              </Badge>
              <Badge variant="outline" className="h-7 rounded-md px-2.5">
                {page.citationCount} citations
              </Badge>
              <Badge variant="outline" className="h-7 rounded-md px-2.5">
                {page.promptCount} réponses
              </Badge>
              <Badge variant="outline" className="h-7 rounded-md px-2.5">
                {page.modelCount} LLMs
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button asChild className="rounded-md">
              <a href={page.url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Ouvrir
              </a>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background/70">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="text-sm font-semibold text-foreground">
              Réponses qui citent cette page
            </div>
          </div>
          <ScrollArea className="h-[300px] overflow-hidden">
            <div className="space-y-3 p-4 pr-6 pb-8">
              {page.samples.map((sample) => (
                <div
                  key={sample.id}
                  className="min-w-0 rounded-md border border-border/60 bg-background px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {sample.model ? (
                      <ModelBadgeItem badge={sample.model} />
                    ) : (
                      <Badge variant="outline" className="font-normal">
                        Modèle inconnu
                      </Badge>
                    )}
                    {sample.persona ? <Badge variant="outline">{sample.persona}</Badge> : null}
                    <span className="text-[11px] text-muted-foreground">
                      {sample.citationCount}{" "}
                      {sample.citationCount > 1 ? "citations" : "citation"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">{sample.prompt}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

function PageDetailSkeleton() {
  return (
    <Card className="flex min-h-0 overflow-hidden rounded-md border-border/60 bg-card/95 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">
                <SectionTitle>Détail de la page</SectionTitle>
              </CardTitle>
              <CardDescription className="flex min-w-0 items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <Skeleton className="h-4 w-[28rem] max-w-full" />
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-28 rounded-md" />
              <Skeleton className="h-7 w-24 rounded-md" />
              <Skeleton className="h-7 w-24 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 shrink-0 rounded-md" />
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background/70">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="text-sm font-semibold text-foreground">
              Réponses qui citent cette page
            </div>
          </div>
          <div className="space-y-3 p-4 pr-6 pb-8">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="min-w-0 rounded-md border border-border/60 bg-background px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-6 w-24 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-md" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
