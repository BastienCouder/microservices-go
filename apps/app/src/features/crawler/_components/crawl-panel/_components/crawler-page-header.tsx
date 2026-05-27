import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils";

type CrawlerPageHeaderProps = {
  reviewingDiscoveredPages: boolean;
  hasAnalysis: boolean;
  reanalyzing: boolean;
  discovering: boolean;
  canDiscover: boolean;
  canCrawlSelected: boolean;
  canReanalyze: boolean;
  loadingLatest: boolean;
  onDiscover: () => void;
  onCrawlSelected: () => void;
  onAnalyzeSite: () => void;
};

export function CrawlerPageHeader({
  reviewingDiscoveredPages,
  hasAnalysis,
  reanalyzing,
  discovering,
  canDiscover,
  canCrawlSelected,
  canReanalyze,
  loadingLatest,
  onDiscover,
  onCrawlSelected,
  onAnalyzeSite,
}: CrawlerPageHeaderProps) {
  return (
    <PageHeader
      title="Crawler"
      baseline="Résultats du dernier crawl avec erreurs SEO/GEO et actions recommandées."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {reviewingDiscoveredPages ? (
            <Button
              type="button"
              onClick={onCrawlSelected}
              disabled={!canCrawlSelected || reanalyzing}
            >
              <RefreshCw
                className={cn("h-4 w-4", reanalyzing && "animate-spin")}
              />
              {reanalyzing
                ? "Analyse en cours"
                : "Analyser les pages sélectionnées"}
            </Button>
          ) : hasAnalysis ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onDiscover}
                disabled={!canDiscover || loadingLatest}
              >
                <RefreshCw
                  className={cn("h-4 w-4", discovering && "animate-spin")}
                />
                {discovering
                  ? "Mise à jour en cours"
                  : "Mettre à jour la liste des pages"}
              </Button>
              <Button
                type="button"
                onClick={onCrawlSelected}
                disabled={!canCrawlSelected || loadingLatest || reanalyzing}
                aria-label="Analyser les pages sélectionnées"
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
                />
                {reanalyzing
                  ? "Analyse en cours"
                  : "Analyser les pages sélectionnées"}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              onClick={onAnalyzeSite}
              disabled={!canReanalyze || loadingLatest}
              aria-label="Découvrir les URLs du site"
            >
              <RefreshCw
                className={cn("h-4 w-4", reanalyzing && "animate-spin")}
              />
              {reanalyzing ? "Découverte en cours" : "Découvrir les URLs"}
            </Button>
          )}
        </div>
      }
      actionsVariant="classic"
    />
  );
}
