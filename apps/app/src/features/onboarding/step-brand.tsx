import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { previewOnboardingBrandProfile } from "./onboarding-api";
import {
  OnboardingField,
  OnboardingStep,
  OnboardingStepFooter,
} from "./step-shell";

type StepBrandProps = {
  apiBaseURL: string;
  hideBack?: boolean;
  nextLabel?: string;
};

export function StepBrand({
  apiBaseURL,
  hideBack = false,
  nextLabel = "Next",
}: StepBrandProps) {
  const {
    brandName,
    setBrandName,
    websiteUrl,
    brandShortDescription,
    setBrandShortDescription,
    brandDescription,
    setBrandDescription,
    industry,
    setIndustry,
    keyFeatures,
    setKeyFeatures,
    competitors,
    setCompetitors,
    selectedPrompts,
    setSelectedPrompts,
    brandPreparationCompleted,
    setBrandPreparationCompleted,
    nextStep,
    prevStep,
  } = useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const [newFeature, setNewFeature] = useState("");
  const [prepProgress, setPrepProgress] = useState(0);

  useEffect(() => {
    if (brandPreparationCompleted) return;

    const abortController = new AbortController();
    const durationMs = 15_600;
    const startedAt = Date.now();
    let timeoutId: number | undefined;
    const timer = window.setInterval(() => {
      const progress = Math.min(
        ((Date.now() - startedAt) / durationMs) * 100 + Math.random() * 2,
        100,
      );

      setPrepProgress(Math.round(progress));
      if (progress < 100) return;

      window.clearInterval(timer);
      timeoutId = window.setTimeout(() => {
        setBrandPreparationCompleted(true);
      }, 420);
    }, 170);

    if (websiteUrl.trim()) {
      void previewOnboardingBrandProfile(
        apiBaseURL,
        {
          websiteUrl,
          brandName,
        },
        abortController.signal,
      )
        .then((preview) => {
          if (abortController.signal.aborted) return;
          if (!brandName.trim() && preview.brandName) {
            setBrandName(preview.brandName);
          }
          if (!brandShortDescription.trim() && preview.brandShortDescription) {
            setBrandShortDescription(preview.brandShortDescription);
          }
          if (!brandDescription.trim() && preview.brandDescription) {
            setBrandDescription(preview.brandDescription);
          }
          if (!industry.trim() && preview.industry) {
            setIndustry(preview.industry);
          }
          if (keyFeatures.length === 0 && preview.keyFeatures.length > 0) {
            setKeyFeatures(preview.keyFeatures);
          }
          if (competitors.length === 0 && preview.competitors.length > 0) {
            setCompetitors(
              preview.competitors.map((competitor) => ({
                ...competitor,
                logo: competitor.name.slice(0, 2).toUpperCase(),
              })),
            );
          }
          if (selectedPrompts.length === 0 && preview.prompts.length > 0) {
            setSelectedPrompts(preview.prompts);
          }
          setPrepProgress(100);
          setBrandPreparationCompleted(true);
        })
        .catch(() => {});
    }

    return () => {
      abortController.abort();
      window.clearInterval(timer);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    apiBaseURL,
    brandDescription,
    brandName,
    brandPreparationCompleted,
    brandShortDescription,
    competitors,
    industry,
    keyFeatures,
    selectedPrompts,
    setBrandDescription,
    setBrandName,
    setBrandPreparationCompleted,
    setBrandShortDescription,
    setCompetitors,
    setIndustry,
    setKeyFeatures,
    setSelectedPrompts,
    websiteUrl,
  ]);

  const addFeature = () => {
    const feature = newFeature.trim();
    if (!feature || keyFeatures.includes(feature)) return;
    setKeyFeatures([...keyFeatures, feature]);
    setNewFeature("");
  };

  const updateFeature = (index: number, value: string) => {
    setKeyFeatures(
      keyFeatures.map((feature, featureIndex) =>
        featureIndex === index ? value : feature,
      ),
    );
  };

  const prepMessage =
    [
      t("brandPrepMessage1"),
      t("brandPrepMessage2"),
      t("brandPrepMessage3"),
    ][
      Math.min(
        2,
        Math.floor((prepProgress / 100) * 3),
      )
    ];

  if (!brandPreparationCompleted) {
    return (
      <OnboardingStep
        title={t("brandPrepTitle")}
        description={prepMessage}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm font-medium text-primary">
            <span>{t("brandPrepProgressLabel")}</span>
            <span>{prepProgress}%</span>
          </div>
          <Progress value={prepProgress} className="h-2" />
        </div>
      </OnboardingStep>
    );
  }

  return (
    <OnboardingStep
      title={t("brandTitle")}
      description={t("brandDescription")}
      footer={
        <OnboardingStepFooter
          hideBack={hideBack}
          onBack={prevStep}
          onNext={nextStep}
          nextLabel={nextLabel === "Next" ? undefined : nextLabel}
        />
      }
    >
      <OnboardingField label={t("brandNameLabel")} htmlFor="brand-name">
        <Input
          id="brand-name"
          value={brandName}
          onChange={(event) => setBrandName(event.target.value)}
          placeholder={t("brandNamePlaceholder")}
        />
      </OnboardingField>

      <OnboardingField
        label={t("brandShortDescriptionLabel")}
        htmlFor="brand-short-description"
        description={t("brandShortDescriptionHint")}
      >
        <Textarea
          id="brand-short-description"
          className="min-h-[86px] text-sm"
          value={brandShortDescription}
          onChange={(event) => setBrandShortDescription(event.target.value)}
          placeholder={t("brandShortDescriptionPlaceholder")}
        />
      </OnboardingField>

      <OnboardingField
        label={t("brandIndustryLabel")}
        htmlFor="brand-industry"
        description={t("brandIndustryHint")}
      >
        <Input
          id="brand-industry"
          value={industry}
          onChange={(event) => setIndustry(event.target.value)}
          placeholder={t("brandIndustryPlaceholder")}
        />
      </OnboardingField>

      <OnboardingField
        label={t("brandLongDescriptionLabel")}
        htmlFor="brand-description"
        description={t("brandLongDescriptionHint")}
      >
        <Textarea
          id="brand-description"
          className="min-h-[180px] text-sm"
          value={brandDescription}
          onChange={(event) => setBrandDescription(event.target.value)}
          placeholder={t("brandLongDescriptionPlaceholder")}
        />
      </OnboardingField>

      <OnboardingField
        label={t("brandFeaturesLabel")}
        description={t("brandFeaturesHint")}
      >
        <div className="space-y-2">
          {keyFeatures.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md border border-border/80 px-3 py-2"
            >
              <Input
                value={feature}
                onChange={(event) => updateFeature(index, event.target.value)}
                className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setKeyFeatures(keyFeatures.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                {t("remove")}
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              value={newFeature}
              onChange={(event) => setNewFeature(event.target.value)}
              placeholder={t("brandFeaturePlaceholder")}
              onKeyDown={(event) => {
                if (event.key === "Enter") addFeature();
              }}
            />
            <Button variant="outline" size="sm" onClick={addFeature}>
              {t("addFeature")}
            </Button>
          </div>
        </div>
      </OnboardingField>
    </OnboardingStep>
  );
}
