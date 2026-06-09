import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";

type CreditConfirmation = {
  monthlyCredits: number;
  planLabel: string;
  remainingCredits: number;
  usedCredits: number;
  isLoading: boolean;
  hasQuota: boolean;
};

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
  estimatedAnalyzeCredits: number;
  estimatedDiscoverCredits: number;
  creditConfirmation: CreditConfirmation;
  copy?: {
    title?: string;
    baseline?: string;
    discoverInitialLabel?: string;
    discoverRunningLabel?: string;
    analyzeSelectionLabel?: string;
    analyzeRunningLabel?: string;
    reviewAnalyzedPagesLabel?: string;
    reviewAnalyzedPagesRunningLabel?: string;
    analyzeConfirmTitle?: string;
    discoverConfirmTitle?: string;
    reviewConfirmTitle?: string;
    confirmLoadingLabel?: string;
    cancelLabel?: string;
    discoverAriaLabel?: string;
    newSelectionAriaLabel?: string;
    creditQuotaCurrentPlanFallback?: string;
    creditQuotaLoadingLabel?: string;
    creditQuotaCheckingLabel?: string;
    creditConsumptionTemplate?: string;
  };
};

function creditDialogDescription(
  actionLabel: string,
  credits: number,
  creditConfirmation: CreditConfirmation,
  copy?: CrawlerPageHeaderProps["copy"],
) {
  const quotaLabel =
    creditConfirmation.hasQuota && creditConfirmation.monthlyCredits > 0
      ? `Current balance: ${creditConfirmation.remainingCredits}/${creditConfirmation.monthlyCredits} credits remaining on the ${creditConfirmation.planLabel || copy?.creditQuotaCurrentPlanFallback || "current"} plan.`
      : creditConfirmation.isLoading
        ? copy?.creditQuotaLoadingLabel || "Loading the organization credit quota."
        : copy?.creditQuotaCheckingLabel || "The organization credit quota will be checked before execution.";

  return (
    copy?.creditConsumptionTemplate?.replace("{{actionLabel}}", actionLabel).replace("{{credits}}", String(credits)).replace("{{quotaLabel}}", quotaLabel) ||
    `${actionLabel} will consume about ${credits} credits. ${quotaLabel}`
  );
}

function CreditConfirmDialog({
  actionLabel,
  children,
  confirmLabel,
  copy,
  credits,
  creditConfirmation,
  disabled,
  loading,
  onConfirm,
  title,
}: {
  actionLabel: string;
  children: ReactNode;
  confirmLabel: string;
  credits: number;
  creditConfirmation: CreditConfirmation;
  disabled: boolean;
  loading: boolean;
  onConfirm: () => void;
  title: string;
  copy?: CrawlerPageHeaderProps["copy"];
}) {
  return (
    <ConfirmDialog
      title={title}
      description={creditDialogDescription(actionLabel, credits, creditConfirmation, copy)}
      confirmLabel={loading ? copy?.confirmLoadingLabel || "Processing..." : confirmLabel}
      cancelLabel={copy?.cancelLabel || "Cancel"}
      confirmVariant="default"
      confirmDisabled={disabled}
      loading={loading}
      onConfirm={onConfirm}
      trigger={children}
    />
  );
}

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
  estimatedAnalyzeCredits,
  estimatedDiscoverCredits,
  creditConfirmation,
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
    analyzeConfirmTitle:
      copy?.analyzeConfirmTitle ?? t("confirmContentAnalysisTitle"),
    discoverConfirmTitle:
      copy?.discoverConfirmTitle ?? t("confirmPageDiscoveryTitle"),
    reviewConfirmTitle:
      copy?.reviewConfirmTitle ?? t("confirmPageDiscoveryTitle"),
    confirmLoadingLabel:
      copy?.confirmLoadingLabel ?? t("processing"),
    cancelLabel: copy?.cancelLabel ?? t("cancel"),
    discoverAriaLabel:
      copy?.discoverAriaLabel ?? t("discoverSiteUrlsAriaLabel"),
    newSelectionAriaLabel:
      copy?.newSelectionAriaLabel ?? t("newPageSelectionAriaLabel"),
    creditQuotaCurrentPlanFallback:
      copy?.creditQuotaCurrentPlanFallback ?? t("creditQuotaCurrentPlanFallback"),
    creditQuotaLoadingLabel:
      copy?.creditQuotaLoadingLabel ?? t("creditQuotaLoadingLabel"),
    creditQuotaCheckingLabel:
      copy?.creditQuotaCheckingLabel ?? t("creditQuotaCheckingLabel"),
    creditConsumptionTemplate:
      copy?.creditConsumptionTemplate ?? t("creditConsumptionTemplate"),
  };

  return (
    <PageHeader
      title={labels.title}
      baseline={labels.baseline}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {reviewingDiscoveredPages ? (
            <CreditConfirmDialog
              actionLabel={labels.analyzeSelection}
              confirmLabel={labels.analyzeSelection}
              credits={estimatedAnalyzeCredits}
              creditConfirmation={creditConfirmation}
              disabled={!canCrawlSelected || reanalyzing}
              loading={reanalyzing}
              onConfirm={onCrawlSelected}
              title={localizedCopy.analyzeConfirmTitle}
              copy={localizedCopy}
            >
              <Button
                type="button"
                disabled={!canCrawlSelected || reanalyzing}
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
                />
                {reanalyzing ? labels.analyzeRunning : labels.analyzeSelection}
              </Button>
            </CreditConfirmDialog>
          ) : hasAnalysis ? (
            <CreditConfirmDialog
              actionLabel={labels.reviewAnalyzedPages}
              confirmLabel={labels.reviewAnalyzedPages}
              credits={estimatedDiscoverCredits}
              creditConfirmation={creditConfirmation}
              disabled={loadingLatest || reanalyzing}
              loading={reanalyzing}
              onConfirm={onReviewSelection}
              title={localizedCopy.reviewConfirmTitle}
              copy={localizedCopy}
            >
              <Button
                type="button"
                disabled={loadingLatest || reanalyzing}
                aria-label={localizedCopy.newSelectionAriaLabel}
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
                />
                {reanalyzing
                  ? labels.reviewAnalyzedPagesRunning
                  : labels.reviewAnalyzedPages}
              </Button>
            </CreditConfirmDialog>
          ) : (
            <CreditConfirmDialog
              actionLabel={labels.discoverInitial}
              confirmLabel={labels.discoverInitial}
              credits={estimatedDiscoverCredits}
              creditConfirmation={creditConfirmation}
              disabled={!canReanalyze || loadingLatest}
              loading={reanalyzing}
              onConfirm={onAnalyzeSite}
              title={localizedCopy.discoverConfirmTitle}
              copy={localizedCopy}
            >
              <Button
                type="button"
                disabled={!canReanalyze || loadingLatest}
                aria-label={localizedCopy.discoverAriaLabel}
              >
                <RefreshCw
                  className={cn("h-4 w-4", reanalyzing && "animate-spin")}
              />
                {reanalyzing ? labels.discoverRunning : labels.discoverInitial}
              </Button>
            </CreditConfirmDialog>
          )}
        </div>
      }
      actionsVariant="classic"
    />
  );
}
