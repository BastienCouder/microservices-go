import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { pushErrorToast } from "@/components/ui/toast-actions";
import { createOnboardingProject } from "@/features/onboarding/onboarding-api";
import { useOnboarding } from "@/hooks/use-onboarding";
import { buildScopedHref, readSelectedOrganizationID, storeSelectedProjectID } from "@/shared/selection";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { OnboardingStep, OnboardingStepFooter } from "./step-shell";

type StepAnalysisProps = {
  apiBaseURL: string;
  hideBack?: boolean;
};

export function StepAnalysis({ apiBaseURL, hideBack = false }: StepAnalysisProps) {
  const {
    organizationName,
    websiteUrl,
    attributionSource,
    brandName,
    brandDescription,
    industry,
    competitors,
    selectedPrompts,
    selectedModels,
    prevStep,
  } = useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const navigate = useNavigate();
  const [progress, setProgress] = useState(10);
  const [createdProjectId, setCreatedProjectId] = useState("");
  const creationStartedRef = useRef(false);
  const attributionLabel =
    attributionSource === "other"
      ? t("attributionOptionOther")
      : attributionSource || t("notProvided");

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((currentProgress) => {
        const ceiling = createdProjectId ? 100 : 92;
        const nextProgress = Math.min(currentProgress + Math.random() * 7, ceiling);
        if (nextProgress >= ceiling) {
          window.clearInterval(timer);
        }
        return nextProgress;
      });
    }, 350);

    return () => window.clearInterval(timer);
  }, [createdProjectId]);

  useEffect(() => {
    if (creationStartedRef.current) return;
    creationStartedRef.current = true;

    const organizationId = readSelectedOrganizationID();
    void createOnboardingProject(apiBaseURL, {
      organizationId,
      organizationName,
      brandName,
      websiteUrl,
      attributionSource,
      brandDescription,
      industry,
      competitors,
      prompts: selectedPrompts,
      modelIds: selectedModels,
    })
      .then(({ projectId, projectSlug }) => {
        storeSelectedProjectID(projectId);
        setCreatedProjectId(projectSlug);
        setProgress(100);
      })
      .catch((error) => {
        pushErrorToast(error, "Impossible de creer le projet.");
      });
  }, [
    apiBaseURL,
    attributionSource,
    brandDescription,
    brandName,
    competitors,
    industry,
    organizationName,
    selectedModels,
    selectedPrompts,
    websiteUrl,
  ]);

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
          onNext={() =>
            navigate(buildScopedHref("/monitoring", { project: createdProjectId }))
          }
          nextDisabled={createdProjectId === ""}
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
