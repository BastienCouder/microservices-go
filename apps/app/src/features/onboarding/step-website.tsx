import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  OnboardingField,
  OnboardingStep,
} from "./step-shell";

type StepWebsiteProps = {
  isDemo?: boolean;
};

export function StepWebsite({ isDemo = false }: StepWebsiteProps) {
  const { websiteUrl, setWebsiteUrl, brandName, setBrandName, nextStep } =
    useOnboarding();
  const { t } = useScopedI18n("onboarding");

  return (
    <OnboardingStep
      title={t("websiteTitle")}
      description={t("websiteDescription")}
      footer={
        <div className="flex w-full justify-end">
          <Button onClick={nextStep}>{t("continue")}</Button>
        </div>
      }
    >
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
          placeholder={t("websiteUrlPlaceholder")}
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          autoFocus={!isDemo}
        />
      </OnboardingField>
    </OnboardingStep>
  );
}
