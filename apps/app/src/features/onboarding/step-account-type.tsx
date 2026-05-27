import { ArrowRight, BriefcaseBusiness, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { OnboardingStep } from "./step-shell";

export function StepAccountType() {
  const { setStep } = useOnboarding();
  const { t } = useScopedI18n("onboarding");

  return (
    <OnboardingStep
      title={t("accountTypeTitle")}
      description={t("accountTypeDescription")}
      contentClassName="grid gap-4 md:grid-cols-2"
    >
      <div className="flex min-h-64 flex-col justify-between rounded-md border border-primary/20 bg-primary/5 p-5">
        <div className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold leading-snug">
              {t("accountTypeBusinessTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("accountTypeBusinessDescription")}
            </p>
          </div>
        </div>
        <Button className="mt-5 w-full justify-between" onClick={() => setStep(2)}>
          <span>{t("accountTypeBusinessAction")}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="flex min-h-64 flex-col justify-between rounded-md border border-dashed bg-muted/40 p-5">
        <div className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-background text-muted-foreground">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold leading-snug">
              {t("accountTypeIndividualTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("accountTypeIndividualDescription")}
            </p>
          </div>
        </div>
        <Button className="mt-5 w-full" variant="outline" disabled>
          {t("accountTypeIndividualAction")}
        </Button>
      </div>
    </OnboardingStep>
  );
}
