import { Search } from "lucide-react";

import { OnboardingStep } from "@/features/onboarding/step-shell";
import { AnimatedWave } from "@/features/onboarding/animated-wave";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreditConfirmation = {
  monthlyCredits: number;
  planLabel: string;
  remainingCredits: number;
  usedCredits: number;
  isLoading: boolean;
  hasQuota: boolean;
};

type InitialSetupCardProps = {
  projectName: string;
  projectWebsiteURL: string;
  reanalyzing: boolean;
  canReanalyze: boolean;
  onAnalyzeSite: () => void;
  estimatedDiscoverCredits: number;
  creditConfirmation: CreditConfirmation;
  canEdit: boolean;
  copy?: {
    title?: string;
    titleWithProject?: (projectName: string) => string;
    description?: string;
    discoverLabel?: string;
    discoveringLabel?: string;
  };
};

function creditDialogDescription(
  credits: number,
  creditConfirmation: CreditConfirmation,
) {
  const quotaLabel =
    creditConfirmation.hasQuota && creditConfirmation.monthlyCredits > 0
      ? `Solde actuel: ${creditConfirmation.remainingCredits}/${creditConfirmation.monthlyCredits} crédits restants sur le plan ${creditConfirmation.planLabel || "actuel"}.`
      : creditConfirmation.isLoading
        ? "Chargement du quota de crédits de l'organisation."
        : "Le quota de crédits de l'organisation sera vérifié avant l'exécution.";

  return `Découvrir les pages consommera environ ${credits} crédits. ${quotaLabel}`;
}

export function InitialSetupCard({
  projectName,
  projectWebsiteURL,
  reanalyzing,
  canReanalyze,
  onAnalyzeSite,
  estimatedDiscoverCredits,
  creditConfirmation,
  canEdit,
  copy,
}: InitialSetupCardProps) {
  const title = projectName
    ? copy?.titleWithProject?.(projectName) ?? `Découvrir les URLs de ${projectName}`
    : copy?.title ?? "Découvrir les URLs du site";

  return (
    <div className="relative flex flex-1 items-center overflow-hidden bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34%),linear-gradient(180deg,_#f8f9fc_0%,_#f1f3f8_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <AnimatedWave />
      </div>

      <div className="relative z-10 flex w-full items-start justify-center px-6 pb-8 pt-10">
        <div className="w-full max-w-[760px]">
          <OnboardingStep
            title={title}
            description={copy?.description}
            className="rounded-[24px] border-white/80 bg-white/90"
            contentClassName="space-y-5"
          >
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={projectWebsiteURL}
                  placeholder="https://example.com"
                  className="h-11 rounded-xl border-border/70 bg-white pl-9"
                  readOnly
                />
              </div>
            </div>

            {canEdit ? (
            <div className="flex justify-end">
              <ConfirmDialog
                title="Confirmer la découverte des pages"
                description={creditDialogDescription(
                  estimatedDiscoverCredits,
                  creditConfirmation,
                )}
                confirmLabel={
                  reanalyzing
                    ? "Découverte..."
                    : copy?.discoverLabel ?? "Découvrir les URLs"
                }
                cancelLabel="Annuler"
                confirmVariant="default"
                confirmDisabled={!canReanalyze}
                loading={reanalyzing}
                onConfirm={onAnalyzeSite}
                trigger={
                  <Button
                    type="button"
                    disabled={!canReanalyze || reanalyzing}
                    className="min-w-44"
                  >
                    {reanalyzing
                      ? copy?.discoveringLabel ?? "Découverte en cours"
                      : copy?.discoverLabel ?? "Découvrir les URLs"}
                  </Button>
                }
              />
            </div>
            ) : null}
          </OnboardingStep>
        </div>
      </div>
    </div>
  );
}
