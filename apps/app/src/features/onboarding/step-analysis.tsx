import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { OnboardingStep, OnboardingStepFooter } from "./step-shell";

type StepAnalysisProps = {
  hideBack?: boolean;
};

export function StepAnalysis({ hideBack = false }: StepAnalysisProps) {
  const {
    websiteUrl,
    attributionSource,
    brandName,
    selectedPrompts,
    selectedModels,
    prevStep,
  } = useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const navigate = useNavigate();
  const [progress, setProgress] = useState(10);
  const attributionLabel =
    attributionSource === "other"
      ? t("attributionOptionOther")
      : attributionSource || t("notProvided");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((currentProgress) => {
        const nextProgress = Math.min(currentProgress + Math.random() * 7, 100);
        if (nextProgress >= 100) {
          window.clearInterval(timer);
        }
        return nextProgress;
      });
    }, 350);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <OnboardingStep
      title={t("analysisTitle")}
      description={t("analysisDescription", {
        models: selectedModels.length,
        prompts: selectedPrompts.length,
        brand: brandName || t("yourBrand"),
      })}
      footer={
        <OnboardingStepFooter
          hideBack={hideBack}
          onBack={prevStep}
          onNext={() => navigate("/monitoring")}
          // nextDisabled={progress < 95}
          nextLabel={t("goToMonitoring")}
        />
      }
    >
      <div className="space-y-2">
        <Progress value={progress} className="h-3" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("analysisProgressLabel")}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-left text-sm text-zinc-700 sm:grid-cols-2">
        <div className="rounded-md border border-border/80 p-3">
          {t("analysisWebsite", {
            website: websiteUrl || t("notProvided"),
          })}
        </div>
        <div className="rounded-md border border-border/80 p-3">
          {t("analysisAttribution", {
            source: attributionLabel,
          })}
        </div>
        <div className="rounded-md border border-border/80 p-3">
          {t("analysisCompetitors")}
        </div>
        <div className="rounded-md border border-border/80 p-3">
          {t("analysisPrompts")}
        </div>
        <div className="rounded-md border border-border/80 p-3">
          {t("analysisVisibility")}
        </div>
      </div>
    </OnboardingStep>
  );
}
