import { Search } from "lucide-react";

import { OnboardingStep } from "@/features/onboarding/step-shell";
import { AnimatedWave } from "@/features/onboarding/animated-wave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type InitialSetupCardProps = {
  projectName: string;
  projectWebsiteURL: string;
  reanalyzing: boolean;
  canReanalyze: boolean;
  onAnalyzeSite: () => void;
  canEdit: boolean;
  copy?: {
    title?: string;
    titleWithProject?: (projectName: string) => string;
    description?: string;
    discoverLabel?: string;
    discoveringLabel?: string;
  };
};

export function InitialSetupCard({
  projectName,
  projectWebsiteURL,
  reanalyzing,
  canReanalyze,
  onAnalyzeSite,
  canEdit,
  copy,
}: InitialSetupCardProps) {
  const { t } = useScopedI18n("crawler-panel");
  const title = projectName
    ? copy?.titleWithProject?.(projectName) ?? t("discoverProjectTitle", { projectName })
    : copy?.title ?? t("discoverSiteTitle");
  const localizedCopy = {
    ...copy,
    discoverLabel: copy?.discoverLabel ?? t("discoverUrls"),
    discoveringLabel:
      copy?.discoveringLabel ?? t("discoveringInProgress"),
  };

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
                  <Button
                    type="button"
                    disabled={!canReanalyze || reanalyzing}
                    className="min-w-44"
                    onClick={onAnalyzeSite}
                  >
                    {reanalyzing
                      ? localizedCopy.discoveringLabel
                      : localizedCopy.discoverLabel}
                  </Button>
            </div>
            ) : null}
          </OnboardingStep>
        </div>
      </div>
    </div>
  );
}
