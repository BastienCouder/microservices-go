import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";

type CrawlerPageHeaderProps = {
  reviewingDiscoveredPages: boolean;
  hasAnalysis: boolean;
  reanalyzing: boolean;
  canCrawlSelected: boolean;
  canReanalyze: boolean;
  loadingLatest: boolean;
  onCrawlSelected: () => void;
  onAnalyzeSite: () => void;
  onReviewSelection: () => void;
  canEdit: boolean;
  copy?: {
    title?: string;
    baseline?: string;
    discoverInitialLabel?: string;
    discoverRunningLabel?: string;
    analyzeSelectionLabel?: string;
    analyzeRunningLabel?: string;
    reviewAnalyzedPagesLabel?: string;
    reviewAnalyzedPagesRunningLabel?: string;
    discoverAriaLabel?: string;
    newSelectionAriaLabel?: string;
  };
};

export function CrawlerPageHeader({
  reviewingDiscoveredPages,
  hasAnalysis,
  reanalyzing,
  canCrawlSelected,
  canReanalyze,
  loadingLatest,
  onCrawlSelected,
  onAnalyzeSite,
  onReviewSelection,
  canEdit,
  copy,
}: CrawlerPageHeaderProps) {
  const { t } = useScopedI18n("crawler-panel");
  const labels = {
    title: copy?.title ?? t("siteAuditTitle"),
    baseline:
      copy?.baseline ??
      t("siteAuditBaseline"),
    discoverInitial: copy?.discoverInitialLabel ?? t("discoverUrls"),
    discoverRunning: copy?.discoverRunningLabel ?? t("discoveringInProgress"),
    analyzeSelection: copy?.analyzeSelectionLabel ?? t("analyzeSelection"),
    analyzeRunning: copy?.analyzeRunningLabel ?? t("analysisInProgress"),
    reviewAnalyzedPages:
      copy?.reviewAnalyzedPagesLabel ?? t("newSelection"),
    reviewAnalyzedPagesRunning:
      copy?.reviewAnalyzedPagesRunningLabel ?? t("discoveringInProgress"),
  };
  const localizedCopy = {
    ...copy,
    discoverAriaLabel:
      copy?.discoverAriaLabel ?? t("discoverSiteUrlsAriaLabel"),
    newSelectionAriaLabel:
      copy?.newSelectionAriaLabel ?? t("newPageSelectionAriaLabel"),
  };

  return (
    <PageHeader
      title={labels.title}
      baseline={labels.baseline}
      actions={canEdit ? (
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          {reviewingDiscoveredPages ? (
              <Button
                type="button"
                disabled={!canCrawlSelected || reanalyzing}
                onClick={onCrawlSelected}
                className="w-full lg:w-auto"
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
                />
                {reanalyzing ? labels.analyzeRunning : labels.analyzeSelection}
              </Button>
          ) : hasAnalysis ? (
              <Button
                type="button"
                disabled={loadingLatest || reanalyzing}
                aria-label={localizedCopy.newSelectionAriaLabel}
                onClick={onReviewSelection}
                className="w-full lg:w-auto"
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
                />
                {reanalyzing
                  ? labels.reviewAnalyzedPagesRunning
                  : labels.reviewAnalyzedPages}
              </Button>
          ) : (
              <Button
                type="button"
                disabled={!canReanalyze || loadingLatest}
                aria-label={localizedCopy.discoverAriaLabel}
                onClick={onAnalyzeSite}
                className="w-full lg:w-auto"
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
              />
                {reanalyzing ? labels.discoverRunning : labels.discoverInitial}
              </Button>
          )}
        </div>
      ) : null}
      actionsVariant="classic"
    />
  );
}
