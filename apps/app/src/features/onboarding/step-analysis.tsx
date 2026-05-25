import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { pushErrorToast, pushWarningToast } from "@/components/ui/toast-actions";
import { createOnboardingProject } from "@/features/onboarding/onboarding-api";
import {
  clearPersistedOnboardingState,
  useOnboarding,
} from "@/hooks/use-onboarding";
import {
  buildScopedHref,
  readSelectedOrganizationID,
  storeSelectedProjectContext,
} from "@/shared/selection";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { OnboardingStep } from "./step-shell";

type StepAnalysisProps = {
  apiBaseURL: string;
  hideBack?: boolean;
};

export function StepAnalysis({ apiBaseURL, hideBack: _hideBack = false }: StepAnalysisProps) {
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
  } = useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const navigate = useNavigate();
  const [progress, setProgress] = useState(10);
  const [createdProjectId, setCreatedProjectId] = useState("");
  const [creationError, setCreationError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const startedAttemptRef = useRef<number | null>(null);
  const analysisRetryErrorMessage = t("analysisRetryError");
  const monitoringHref = buildScopedHref("/monitoring", { project: createdProjectId });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((currentProgress) => {
        const ceiling = createdProjectId ? 100 : 95;
        const nextProgress = Math.min(currentProgress + Math.random() * 7, ceiling);
        if (nextProgress >= ceiling) {
          window.clearInterval(timer);
        }
        return nextProgress;
      });
    }, 350);

    return () => window.clearInterval(timer);
  }, [attempt, createdProjectId]);

  useEffect(() => {
    if (startedAttemptRef.current === attempt) {
      return;
    }
    startedAttemptRef.current = attempt;

    let cancelled = false;
    setCreationError(null);

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
      .then(({ projectId, projectSlug, organizationId: projectOrganizationId, warnings }) => {
        if (cancelled) return;
        storeSelectedProjectContext({
          organizationId: projectOrganizationId,
          projectId,
          projectToken: projectSlug,
        });
        clearPersistedOnboardingState();
        setCreatedProjectId(projectSlug);
        setProgress(100);
        if (warnings.length > 0) {
          pushWarningToast(warnings.join(" "));
        }
      })
      .catch((error) => {
        if (cancelled) return;
        const nextMessage =
          error instanceof Error
            ? error.message
            : analysisRetryErrorMessage;
        setCreationError(nextMessage);
        pushErrorToast(error, "Impossible de creer le projet.");
      });

    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    apiBaseURL,
    attributionSource,
    brandDescription,
    brandName,
    competitors,
    industry,
    organizationName,
    selectedModels,
    selectedPrompts,
    analysisRetryErrorMessage,
    websiteUrl,
  ]);

  useEffect(() => {
    if (!createdProjectId || creationError) {
      return;
    }

    const timeout = window.setTimeout(() => {
      navigate(monitoringHref);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [createdProjectId, creationError, monitoringHref, navigate]);

  function retryCreateProject() {
    setCreatedProjectId("");
    setCreationError(null);
    setProgress(10);
    setAttempt((current) => current + 1);
  }

  return (
    <OnboardingStep
      title={t("analysisTitle")}
    >
      <div className="space-y-2">
        <Progress value={progress} className="h-3" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{t("analysisProgressLabel")}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {creationError ? (
        <div>
          <Button type="button" variant="outline" onClick={retryCreateProject}>
            {t("analysisRetry")}
          </Button>
        </div>
      ) : null}
    </OnboardingStep>
  );
}
