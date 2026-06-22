import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { loadOnboardingOrganizationName } from "./onboarding-api";
import {
  OnboardingField,
  OnboardingStep,
} from "./step-shell";

type StepWebsiteProps = {
  apiBaseURL: string;
  organizationId?: string;
  isDemo?: boolean;
};

export function StepWebsite({
  apiBaseURL,
  organizationId = "",
  isDemo = false,
}: StepWebsiteProps) {
  const {
    organizationName,
    setOrganizationName,
    websiteUrl,
    setWebsiteUrl,
    brandName,
    setBrandName,
    nextStep,
  } = useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const canContinue =
    organizationName.trim() !== "" &&
    brandName.trim() !== "" &&
    websiteUrl.trim() !== "";

  useEffect(() => {
    if (organizationName.trim() !== "" || organizationId.trim() === "") {
      return;
    }

    let cancelled = false;

    void loadOnboardingOrganizationName(apiBaseURL, organizationId)
      .then((name) => {
        if (cancelled || name.trim() === "") {
          return;
        }
        setOrganizationName(name);
      })
      .catch(() => {
        // Keep the field editable even if the preload fails.
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseURL, organizationId, organizationName, setOrganizationName]);

  return (
    <OnboardingStep
      title={t("websiteTitle")}
      footer={
        <div className="flex w-full justify-end">
          <Button onClick={nextStep} disabled={!canContinue}>
            {t("next")}
          </Button>
        </div>
      }
    >
      <OnboardingField label={t("organizationNameLabel")} htmlFor="organizationName">
        <Input
          id="organizationName"
          value={organizationName}
          onChange={(event) => setOrganizationName(event.target.value)}
          placeholder={t("organizationNamePlaceholder")}
        />
      </OnboardingField>

      <OnboardingField label={t("brandNameLabel")} htmlFor="brandName">
        <Input
          id="brandName"
          value={brandName}
          onChange={(event) => setBrandName(event.target.value)}
          autoFocus={isDemo}
        />
      </OnboardingField>

      <OnboardingField
        label={t("websiteUrlLabel")}
        htmlFor="website"
        description={t("websiteUrlHint")}
      >
        <Input
          id="website"
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          autoFocus={!isDemo}
        />
      </OnboardingField>
    </OnboardingStep>
  );
}
