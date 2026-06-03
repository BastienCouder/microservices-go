import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  OnboardingField,
  OnboardingStep,
} from "./step-shell";

type StepWebsiteProps = {
  askOrganizationName?: boolean;
  isDemo?: boolean;
};

export function StepWebsite({
  askOrganizationName = false,
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
    brandName.trim() !== "" &&
    websiteUrl.trim() !== "" &&
    (!askOrganizationName || organizationName.trim() !== "");

  return (
    <OnboardingStep
      title={t("websiteTitle")}
      description={t("websiteDescription")}
      footer={
        <div className="flex w-full justify-end">
          <Button onClick={nextStep} disabled={!canContinue}>
            {t("continue")}
          </Button>
        </div>
      }
    >
      {askOrganizationName ? (
        <OnboardingField label={t("organizationNameLabel")} htmlFor="organizationName">
          <Input
            id="organizationName"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder={t("organizationNamePlaceholder")}
          />
        </OnboardingField>
      ) : null}

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
