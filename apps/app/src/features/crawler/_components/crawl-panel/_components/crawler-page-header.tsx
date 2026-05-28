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
  onReviewSelection: () => void;
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
  onReviewSelection,
}: CrawlerPageHeaderProps) {
  return (
    <PageHeader
      title="Audit du site"
      baseline="Workflow: 1. découvrir les URLs avec Cloudflare, 2. choisir les pages, 3. analyser le contenu sélectionné."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {reviewingDiscoveredPages ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onDiscover}
                disabled={!canDiscover || discovering}
              >
                <RefreshCw
                  className={cn("h-4 w-4", discovering && "animate-spin")}
                />
                {discovering ? "Actualisation..." : "Actualiser les URLs"}
              </Button>
              <Button
                type="button"
                onClick={onCrawlSelected}
                disabled={!canCrawlSelected || reanalyzing}
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
                />
                {reanalyzing ? "Analyse en cours" : "Analyser la sélection"}
              </Button>
            </>
          ) : hasAnalysis ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onReviewSelection}
                disabled={loadingLatest || reanalyzing}
              >
                Modifier la sélection
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onDiscover}
                disabled={!canDiscover || loadingLatest}
              >
                <RefreshCw
                  className={cn("h-4 w-4", discovering && "animate-spin")}
                />
                {discovering ? "Actualisation..." : "Actualiser les URLs"}
              </Button>
              <Button
                type="button"
                onClick={onCrawlSelected}
                disabled={!canCrawlSelected || loadingLatest || reanalyzing}
                aria-label="Analyser la sélection"
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
                />
                {reanalyzing ? "Analyse en cours" : "Analyser la sélection"}
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
