import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
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
  };
};

function creditDialogDescription(
  actionLabel: string,
  credits: number,
  creditConfirmation: CreditConfirmation,
) {
  const quotaLabel =
    creditConfirmation.hasQuota && creditConfirmation.monthlyCredits > 0
      ? `Solde actuel: ${creditConfirmation.remainingCredits}/${creditConfirmation.monthlyCredits} crédits restants sur le plan ${creditConfirmation.planLabel || "actuel"}.`
      : creditConfirmation.isLoading
        ? "Chargement du quota de crédits de l'organisation."
        : "Le quota de crédits de l'organisation sera vérifié avant l'exécution.";

  return `${actionLabel} consommera environ ${credits} crédits. ${quotaLabel}`;
}

function CreditConfirmDialog({
  actionLabel,
  children,
  confirmLabel,
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
}) {
  return (
    <ConfirmDialog
      title={title}
      description={creditDialogDescription(actionLabel, credits, creditConfirmation)}
      confirmLabel={loading ? "Traitement..." : confirmLabel}
      cancelLabel="Annuler"
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
  const labels = {
    title: copy?.title ?? "Audit du site",
    baseline:
      copy?.baseline ??
      "Workflow: 1. découvrir les URLs avec Cloudflare, 2. choisir les pages, 3. analyser le contenu sélectionné.",
    discoverInitial: copy?.discoverInitialLabel ?? "Découvrir les URLs",
    discoverRunning: copy?.discoverRunningLabel ?? "Découverte en cours",
    analyzeSelection: copy?.analyzeSelectionLabel ?? "Analyser la sélection",
    analyzeRunning: copy?.analyzeRunningLabel ?? "Analyse en cours",
    reviewAnalyzedPages:
      copy?.reviewAnalyzedPagesLabel ?? "Nouvelle sélection",
    reviewAnalyzedPagesRunning:
      copy?.reviewAnalyzedPagesRunningLabel ?? "Découverte en cours",
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
              title="Confirmer l'analyse de contenu"
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
              title="Confirmer la découverte des pages"
            >
              <Button
                type="button"
                disabled={loadingLatest || reanalyzing}
                aria-label="Nouvelle sélection de pages"
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
              title="Confirmer la découverte des pages"
            >
              <Button
                type="button"
                disabled={!canReanalyze || loadingLatest}
                aria-label="Découvrir les URLs du site"
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
