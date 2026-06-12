import { useEffect } from "react";
import { Building2, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { OnboardingStep } from "./step-shell";
import {
  ACCOUNT_SETUP_SEARCH,
  getOnboardingSetupMode,
} from "./onboarding-mode";

type AccountTypeOptionProps = {
  title: string;
  description: string;
  actionLabel: string;
  icon: typeof Building2;
  highlighted?: boolean;
  disabled?: boolean;
  onAction?: () => void;
};

function AccountTypeOption({
  title,
  description,
  actionLabel,
  icon: Icon,
  highlighted = false,
  disabled = false,
  onAction,
}: AccountTypeOptionProps) {
  return (
    <article
      className={cn(
        "flex h-full flex-col justify-between rounded-[24px] border p-5 transition-colors",
        highlighted
          ? "border-primary/30 bg-primary/5"
          : "border-border/70 bg-muted/20",
        disabled && "opacity-75",
      )}
    >
      <div className="space-y-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            highlighted ? "bg-primary text-primary-foreground" : "bg-white text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Button
        type="button"
        className="mt-6 w-full"
        variant={highlighted ? "default" : "outline"}
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </article>
  );
}

export function StepAccountType() {
  const navigate = useNavigate();
  const location = useLocation();
  const { nextStep } = useOnboarding();
  const { t } = useScopedI18n("onboarding");

  useEffect(() => {
    if (getOnboardingSetupMode(location.search) !== "account") {
      navigate(`/onboarding${ACCOUNT_SETUP_SEARCH}`, { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <OnboardingStep
      title={t("accountTypeTitle")}
      description={t("accountTypeDescription")}
      contentClassName="grid gap-4 md:grid-cols-2"
    >
      <AccountTypeOption
        title={t("accountTypeBusinessTitle")}
        description={t("accountTypeBusinessDescription")}
        actionLabel={t("accountTypeBusinessAction")}
        icon={Building2}
        highlighted
        onAction={nextStep}
      />
      <AccountTypeOption
        title={t("accountTypeIndividualTitle")}
        description={t("accountTypeIndividualDescription")}
        actionLabel={t("accountTypeIndividualAction")}
        icon={UserRound}
        disabled
      />
    </OnboardingStep>
  );
}
